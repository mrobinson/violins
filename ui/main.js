/*
 * Copyright 2014 Martin Robinson
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var INITIAL_MAP_CENTER = [37.8044, -122.2708];
var INITIAL_MAP_ZOOM = 13;
var DATE_FORMAT = d3.time.format('%b %e, %Y');
var TIME_FORMAT = d3.time.format('%_I:%M%p');

var YEARS = {
    values: [2008, 2009, 2010, 2011, 2012],
    names: ['2008', '2009', '2010', '2011', '2012'],
    counts: [0, 0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'year_chart',
}

var SEXES = {
    names: ['Female', 'Male', 'N/A'],
    counts: [0, 0, 0],
    filtered: d3.set(),
    chart_id: 'sex_chart',
}

var COLLISION_TYPES = {
    names: ['Bike', 'Ped.'],
    counts: [0, 0],
    filtered: d3.set(),
    chart_id: 'type_chart',
}

var AGE_GROUPS = {
    ranges: [14, 24, 25, 74, 150],
    names: ['0-14', '15-24', '25-49', '50-74', '75+', 'N/A'],
    counts: [0, 0, 0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'age_chart',
}

var INJURIES = {
    names: ['Fatal', 'Severe', 'Visible', 'Pain', 'Other'],
    colors: ['red', 'purple', 'orange', 'black', 'black'],
    counts: [0, 0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'injury_chart',
}

var ALL_CATEGORIES = [YEARS, SEXES, COLLISION_TYPES, AGE_GROUPS, INJURIES];

function updateAfterFilterChange() {
    Collision.updateFilteredStatistics();
    map.removeAllMarkers();
    map.addCollisionsToMap(Collision.filteredCollisions);
    statisticsDisplay.update();
}

function Collision(jsonCollision) {
    var self = this;
    this.intersection = jsonCollision.intersection;
    this.date = new Date(jsonCollision.time * 1000);
    this.year = this.date.getFullYear();
    this.sex = jsonCollision.sex;
    this.type = jsonCollision.type;
    this.location = jsonCollision.location;

    this.victims = [];
    for (var v = 0; v < jsonCollision.victims.length; v++) {
        this.victims.push(new Victim(jsonCollision.victims[v]));
    }

    this.countVictims = function(test) {
        var count = 0;
        for (var v = 0; v < self.victims.length; v++) {
            if (test(self.victims[v])) {
                count++;
            }
        }
        return count;
    }

    this.mostSevereInjury = function() {
        if (self.victims.length == 0)
            return 4;
        return d3.min(self.victims.map(function(v) { return v.injury; }));
    }

    this.isBikeCollision = function() { return this.type == 0; }
    this.getDateString = function() { return DATE_FORMAT(self.date); }
    this.getTimeString = function() { return TIME_FORMAT(self.date).toLowerCase(); }
}

Collision.addFromJSON = function(data) {
    if (Collision.collisions === undefined) {
        Collision.collisions = [];
    }

    for (var i = 0; i < data.length; i++) {
        Collision.collisions.push(new Collision(data[i]));
    }

    // TODO: Eventually we should only filter and add the new collisions for performance reasons.
    Collision.updateFilteredStatistics();
    map.addCollisionsToMap(Collision.filteredCollisions);
    statisticsDisplay.update();
}

Collision.updateFilteredStatistics = function() {
    ALL_CATEGORIES.forEach(function(category) {
        for (var i = 0; i < category.counts.length; i++)
            category.counts[i] = 0;
    });

    var totalVictims = 0;
    Collision.filteredCollisions = [];
    Collision.collisions.forEach(function(collision) {
        totalVictims += collision.victims.length;

        var yearIndex = collision.year - YEARS.values[0];
        if (YEARS.filtered.has(yearIndex))
            return;
        if (COLLISION_TYPES.filtered.has(collision.type))
            return;

        var allVictimsFiltered = collision.victims.length > 0;
        collision.victims.forEach(function(victim) {
            if (SEXES.filtered.has(victim.sex))
                return;
            if (AGE_GROUPS.filtered.has(victim.ageGroup))
                return;
            if (INJURIES.filtered.has(victim.injury))
                return;

            SEXES.counts[victim.sex]++;
            AGE_GROUPS.counts[victim.ageGroup]++;
            INJURIES.counts[victim.injury]++;
            allVictimsFiltered = false;
        });

        if (allVictimsFiltered)
            return;

        COLLISION_TYPES.counts[collision.type]++;
        YEARS.counts[yearIndex]++;
        Collision.filteredCollisions.push(collision);
    });
}

function Victim(victimJSON) {
    var self = this;

    this.sexString = function() {
        return SEXES.names[this.sex];
    }

    this.ageString = function() {
        if (self.age < 150) {
            return String(self.age);
        } else {
            return "N/A";
        }
    }

    this.calculateAgeGroup = function() {
        for (var i = 0; i < AGE_GROUPS.ranges.length; i++) {
            if (self.age <= AGE_GROUPS.ranges[i])
                return i;
        }
        return AGE_GROUPS.ranges.length;
    }

    this.isFatality = function () { return self.injury == 0; }
    this.isSevereInjury = function () { return self.injury == 1; }

    this.injury = victimJSON.injury;
    this.age = victimJSON.age;
    this.sex = victimJSON.sex;
    this.ageGroup = this.calculateAgeGroup();

    // The SWITRS injury data is a bit strange, because the least severe injury
    // is 0 and the rest increase in severity. Rework it so that the least severe
    // is the greatest number.
    if (this.injury == 0)
        this.injury = 4;
    else
        this.injury--;
}

function CollisionPopup() {
    var self = this;

    this.show = function(collisionGroup) {
        collisionGroup.sort(function(a, b) {
            if (a.date > b.date)
              return 1;
            if (a.date < b.date)
              return -1;
            return 0;
        });

        var popupHTML = '<div class="collision_detail_popup">';
        popupHTML += '<div class="intersection">';
        popupHTML += collisionGroup[0].intersection;
        popupHTML += '</div>';

        for (var i = 0; i < collisionGroup.length; i++) {
            var collision = collisionGroup[i];
            popupHTML += '<div class="collision">';
            popupHTML += '<div class="header">';
            if (collision.isBikeCollision()) {
                popupHTML += '<div class="symbol">&#x1f6b2;</div>';
            } else {
                popupHTML += '<div class="symbol">&#x1f6b6;</div>';
            }
            popupHTML += '<div class="date">' + collision.getDateString() + '</div>';
            popupHTML += '<div class="time">' + collision.getTimeString() + '</div>';
            popupHTML += '</div>';

            for (var v = 0; v < collision.victims.length; v++) {
                var victim = collision.victims[v];
                var injuryString = INJURIES.names[victim.injury].toLowerCase();
                var sexString = SEXES.names[victim.sex].toLowerCase();

                popupHTML += '<div class="victim">' +
                             '<span class="victim injury_' + injuryString +'">&#x25B6; </span>' +
                              victim.ageString() + ' year old, ' +
                              sexString + ', ' +
                              injuryString + ' injury' +
                              '</div>';
            }
            popupHTML += '</div>';
        }

        popupHTML += '</div>';

        return popupHTML;
    }
}

function Map(mapElementID, collisionPopup) {
    var self = this;
    this.collisionPopup = collisionPopup;
    this.map = L.map(mapElementID).setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM);
    this.markers = [];

    // This allows testing offline without tiles.
    if (L.StamenTileLayer !== undefined)
        this.map.addLayer(new L.StamenTileLayer('toner'));

    this.removeAllMarkers = function() {
        for (var i = 0; i < self.markers.length; i++) {
            self.map.removeLayer(self.markers[i]);
        }
        self.markers = [];
    }

    this.groupCollisionsByIntersection = function(collision) {
        var resultMap = d3.map();

        collision.forEach(function(collision, index) {
            if (!resultMap.has(collision.intersection))
                resultMap.set(collision.intersection, []);
            resultMap.get(collision.intersection).push(collision);
        });

        return resultMap.values();
    }

    this.addCollisionsToMap = function(collisions) {
        var collisionGroups = self.groupCollisionsByIntersection(collisions);
        var map = self.map;
        var smallMarkers = [];

        for (var i = 0; i < collisionGroups.length; i++) {
            var group = collisionGroups[i];
            var smallMarker = group.length > 1;
            var size = smallMarker ? 60 : 80;
            var color = INJURIES.colors[d3.min(group.map(function(collision) { return collision.mostSevereInjury() }))];

            var marker = L.circle(group[0].location, size, {
                stroke: false,
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                opacity: 1.0,
            }).on('click', function(e) {
                var popupText = self.collisionPopup.show(e.target.collisionGroup);
                var popupLocation = e.target.collisionGroup[0].location;
                var popup = L.popup().setLatLng(popupLocation).setContent(popupText).openOn(self.map);
            });
            marker.collisionGroup = group;
            self.markers.push(marker);

            if (!smallMarker)
                marker.addTo(map).
            else
                smallMarkers.push(marker);
        }

        smallMarkers.forEach(function(marker) {
            marker.addTo(map);
        });
    }
}

function StatisticsDisplay(map) {
    var self = this;
    self.map = map;
    this.heightPerGroup = 20;
    this.leftMargin = 50;

    this.update = function() {
        ALL_CATEGORIES.forEach(function(category) {
            self.updateChart(category);
        });
    }

    this.createChart = function(category) {
        var width = document.getElementById(category.chart_id).availWidth;
        var height = category.names.length * self.heightPerGroup;

        var yScale = d3.scale.ordinal()
            .domain(category.names)
            .rangeRoundBands([0, height], 0.05);

        var xScale = d3.scale.linear()
            .domain([0, d3.sum(category.counts)])
            .range([0, width - self.leftMargin]);

        var yAxis = d3.svg.axis()
            .orient("left")
            .scale(yScale)
            .tickValues(category.names);

        var chart = d3.select('#' + category.chart_id)
            .attr("width", width)
            .attr("height", height);

        chart.selectAll('.bar')
            .data(category.counts)
                .enter().append('rect')
                    .attr('class', 'bar')
                    .attr("transform", 'translate(' + self.leftMargin + ', 0)')
                    .attr('class', 'bar')
                    .attr('y', function(d, i) { return yScale(category.names[i]) + 3; })
                    .attr('width', function(d) { return xScale(d); })
                    .attr('height', self.heightPerGroup - 6);

        chart.append("g")
            .attr("transform", 'translate(' + self.leftMargin + ', 0)')
            .call(yAxis);

        function filterIn(text, index) {
            d3.select(this)
                .classed('disabled', false)
                .on('click', filterOut);
            category.filtered.remove(this.filterIndex);
            updateAfterFilterChange();
        }

        function filterOut(text, index) {
            // The index here is the index of the original selection. When we set the
            // onclick handler again, the index will be 0 in fitlerIn, because there
            // is only one element in the selection. We preserve the original index
            // as an attribute here.
            if (this.filterIndex === undefined)
                this.filterIndex = index;
            d3.select(this)
                .classed('disabled', true)
                .on('click', filterIn);
            category.filtered.add(this.filterIndex);
            updateAfterFilterChange();
        }

        chart.selectAll('text')
            .on('click', filterOut);
    }

    this.updateChart = function(category) {
        var width = document.getElementById(category.chart_id).clientWidth;
        var xScale = d3.scale.linear()
            .domain([0, d3.sum(category.counts)])
            .range([0, width - self.leftMargin]);

        d3.select('#' + category.chart_id)
            .selectAll('.bar')
                .data(category.counts)
                    .transition()
                        .attr('width', function(d) { return xScale(d); });
    }

    ALL_CATEGORIES.forEach(function(category) {
        self.createChart(category);
    });
}
