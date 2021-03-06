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

var HALF_STAT_WIDTH = 140; // This is a bit of a hack to avoid a lot of calls to offsetWidth;
var STAT_WIDTH = 275;

var YEARS = {
    values: [2008, 2009, 2010, 2011, 2012, 2013],
    names: ['2008', '2009', '2010', '2011', '2012', '2013'],
    counts: [0, 0, 0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'year_chart',
    chart_width: HALF_STAT_WIDTH,
}

var SEXES = {
    names: ['Female', 'Male', 'N/A'],
    counts: [0, 0, 0],
    filtered: d3.set(),
    chart_id: 'sex_chart',
    chart_width: HALF_STAT_WIDTH,
}

var COLLISION_TYPES = {
    names: ['Bike', 'Ped.'],
    counts: [0, 0],
    filtered: d3.set(),
    chart_id: 'type_chart',
    chart_width: HALF_STAT_WIDTH,
}

var AGE_GROUPS = {
    ranges: [14, 24, 49, 75, 150],
    names: ['0-14', '15-24', '25-49', '50-74', '75+', 'N/A'],
    counts: [0, 0, 0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'age_chart',
    chart_width: HALF_STAT_WIDTH,
}

var INJURIES = {
    names: ['Fatal', 'Severe', 'Visible', 'Pain', 'Other'],
    colors: ['red', 'purple', 'orange', 'black', 'black'],
    counts: [0, 0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'injury_chart',
    chart_width: HALF_STAT_WIDTH,
}

var TIMES_OF_DAY = {
    names: ['6am-12pm', '12pm-6pm', '6pm-12am', '12am-6am'],
    leftMargin: 70,
    counts: [0, 0, 0, 0],
    filtered: d3.set(),
    chart_id: 'time_of_day_chart',
    chart_width: HALF_STAT_WIDTH,
}

var ALL_CATEGORIES = [YEARS, SEXES, COLLISION_TYPES, AGE_GROUPS, INJURIES, TIMES_OF_DAY];

function updateAfterFilterChange() {
    Marker.updateFilteredCollisions();
    map.addCollisionsToMap();
    statisticsDisplay.update();
}

function Marker(jsonMarker) {
    var self = this;
    this.latitude = jsonMarker[0];
    this.longitude = jsonMarker[1];
    this.collisions = [];
    this.filteredCollisions = [];
    this.mapOverlay = null;

    this.mostSevereInjury = function() {
        return d3.min(self.filteredCollisions.map(function(collision) {
             return collision.mostSevereInjury();
        }));
    }

    this.getOverlayRadius = function() {
        return self.filteredCollisions.length == 1 ? 40 : 60;
    }

    this.getOverlayStyle = function() {
        var color = INJURIES.colors[self.mostSevereInjury()];
        return {
            stroke: false,
            color: color,
            fillColor: color,
            fillOpacity: 0.7,
        }
    }

    this.addToMap = function(map) {
        self.mapOverlay = L.circle([self.latitude, self.longitude], self.getOverlayRadius(), self.getOverlayStyle()).on('click', function(e) {
            map.collisionPopup.open(self, map.map);
        });
        self.mapOverlay.addTo(map.map);
        self.mapOverlay._container.style.display = self.filteredCollisions.length > 0 ? "" : "none";
    }

    this.addOrUpdateMapOverlay = function(map) {
        if (self.mapOverlay === null) {
            self.addToMap(map);
            return;
        }

        self.mapOverlay.setRadius(self.getOverlayRadius());
        self.mapOverlay.setStyle(self.getOverlayStyle());

        // TODO: Would be good to do this without undocumented API.
        self.mapOverlay._container.style.display = self.filteredCollisions.length > 0 ? "" : "none";
    }
}

Marker.updateFilteredCollisions = function() {
    ALL_CATEGORIES.forEach(function(category) {
        for (var i = 0; i < category.counts.length; i++)
            category.counts[i] = 0;
    });

    Marker.markers.forEach(function(marker) {
        marker.filteredCollisions = []
        marker.collisions.forEach(function(collision) {
            var yearIndex = collision.year - YEARS.values[0];
            if (YEARS.filtered.has(yearIndex))
                return;
            if (COLLISION_TYPES.filtered.has(collision.type))
                return;
            if (TIMES_OF_DAY.filtered.has(collision.getTimeOfDay()))
                return;

            var allVictimsFiltered = collision.victims.length > 0;
            collision.getUnfilteredVictims().forEach(function(victim) {
                SEXES.counts[victim.sex]++;
                AGE_GROUPS.counts[victim.ageGroup]++;
                INJURIES.counts[victim.injury]++;
                allVictimsFiltered = false;
            });

            // 4 is "Other." If there are no victims, that's similar to a catchall
            // category of injury. This special case ensures that when "other" is filtered
            // out, we skip these collisions missing victims.
            if (collision.victims.length == 0 && INJURIES.filtered.has(4))
                return;

            if (allVictimsFiltered)
                return;

            COLLISION_TYPES.counts[collision.type]++;
            YEARS.counts[yearIndex]++;
            TIMES_OF_DAY.counts[collision.getTimeOfDay()]++;
            marker.filteredCollisions.push(collision);
        });
    });
}

Marker.addFromJSON = function(data) {
    if (Marker.markers === undefined) {
        Marker.markers = [];
    }

    for (var i = 0; i < data.length; i++) {
        Marker.markers.push(new Marker(data[i]));
    }
}

function Collision(jsonCollision) {
    var self = this;
    this.intersection = jsonCollision.intersection;
    this.date = new Date(jsonCollision.time * 1000);
    this.year = this.date.getFullYear();
    this.sex = jsonCollision.sex;
    this.type = jsonCollision.type;
    this.marker = Marker.markers[jsonCollision.marker];
    this.marker.collisions.push(this);

    this.victims = [];
    for (var v = 0; v < jsonCollision.victims.length; v++) {
        this.victims.push(new Victim(jsonCollision.victims[v]));
    }

    this.mostSevereInjury = function() {
        var unfilteredVictims = self.getUnfilteredVictims();
        if (unfilteredVictims.length == 0)
            return 4;
        return d3.min(unfilteredVictims.map(function(v) { return v.injury; }));
    }

    this.getUnfilteredVictims = function() {
        var unfilteredVictims = [];
        self.victims.forEach(function(victim) {
            if (SEXES.filtered.has(victim.sex))
                return;
            if (AGE_GROUPS.filtered.has(victim.ageGroup))
                return;
            if (INJURIES.filtered.has(victim.injury))
                return;
            unfilteredVictims.push(victim);
        });
        return unfilteredVictims;
    }

    this.getTimeOfDay = function() {
        var hours = self.date.getHours();
        if (hours <= 5)
            return 3;
        if (hours <= 11)
            return 0;
        if (hours <= 17)
            return 1;
        return 2;
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
    Marker.updateFilteredCollisions();
    map.addCollisionsToMap();
    statisticsDisplay.update();
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

function CollisionPopup(map) {
    var self = this;
    this.popup = null;

    this.open = function(marker, map) {
        self.marker = marker;
        self.popup = L.popup({closeButton: false})
            .setLatLng([marker.latitude, marker.longitude])
            .setContent(self.getPopupContents())
            .on('popupclose', function() {
                self.popup = null;
                self.marker = null;
            }).openOn(map);
    }

    this.updatePopupContents = function() {
        if (self.popup === null)
            return;

        // FIXME: Use documented API when it exists.
        if (self.marker.filteredCollisions.length == 0)
            self.popup._close();

        self.popup.setContent(self.getPopupContents());
    }

    this.getPopupContents = function() {
        var collisions = self.marker.filteredCollisions;
        if (collisions.length == 0)
            return;

        collisions.sort(function(a, b) {
            if (a.date > b.date)
              return -1;
            if (a.date < b.date)
              return 1;
            return 0;
        });

        var popupHTML = '<div class="collision_detail_popup">';
        popupHTML += '<div class="intersection">';
        popupHTML += collisions[0].intersection;
        popupHTML += '</div>';

        for (var i = 0; i < collisions.length; i++) {
            var collision = collisions[i];
            popupHTML += '<div class="collision">';
            popupHTML += '<div class="header">';
            if (collision.isBikeCollision()) {
                popupHTML += '<div class="symbol"><img src="bicycle.svg"></div>';
            } else {
                popupHTML += '<div class="symbol"><img src="pedestrian.svg"></div>';
            }
            popupHTML += '<div class="date">' + collision.getDateString() + '</div>';
            popupHTML += '<div class="time">' + collision.getTimeString() + '</div>';
            popupHTML += '</div>';

            var unfilteredVictims = collision.getUnfilteredVictims();
            for (var v = 0; v < unfilteredVictims.length; v++) {
                var victim = unfilteredVictims[v];
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

    // This allows testing offline without tiles.
    if (L.StamenTileLayer !== undefined)
        this.map.addLayer(new L.StamenTileLayer('toner'));

    this.addCollisionsToMap = function(c) {
        self.collisionPopup.updatePopupContents();

        // Smaller markers last ensure that they can be seen and clicked when markers overlap. We don't
        // want to sort the static array, since Collision JSON refers to array by index and we may add
        // more collisions in the future.
        var markers = Marker.markers.slice(0);
        markers.sort(function(a, b) {
            if (a.filteredCollisions.length < b.filteredCollisions.length)
              return 1;
            if (a.filteredCollisions.length > b.filteredCollisions.length)
              return -1;
            return 0;
        });

        for (var i = 0; i < markers.length; i++) {
            markers[i].addOrUpdateMapOverlay(self);
        }
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
        var leftMargin = category.leftMargin;
        if (leftMargin === undefined)
            leftMargin = 50;

        var width = category.chart_width;
        var height = category.names.length * self.heightPerGroup;
        var sumOfCounts = d3.sum(category.counts);

        var yScale = d3.scale.ordinal()
            .domain(category.names)
            .rangeRoundBands([0, height], 0.05);

        var xScale = d3.scale.linear()
            .domain([0, sumOfCounts])
            .range([0, width - leftMargin]);

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
                    .attr("transform", 'translate(' + leftMargin + ', 0)')
                    .attr('class', 'bar')
                    .attr('y', function(d, i) { return yScale(category.names[i]) + 3; })
                    .attr('width', function(d) {
                        if (sumOfCounts == 0)
                            return 0;
                        return xScale(d); })
                    .attr('height', self.heightPerGroup - 6);

        chart.append("g")
            .attr("transform", 'translate(' + leftMargin + ', 0)')
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
        var leftMargin = category.leftMargin;
        if (leftMargin === undefined)
            leftMargin = 50;

        var sumOfCounts = d3.sum(category.counts);
        var xScale = d3.scale.linear()
            .domain([0, sumOfCounts])
            .range([0, category.chart_width - self.leftMargin]);

        d3.select('#' + category.chart_id)
            .selectAll('.bar')
                .data(category.counts)
                    .transition()
                    .attr('width', function(d) {
                        if (sumOfCounts == 0)
                            return 0;
                        return xScale(d); });
    }

    ALL_CATEGORIES.forEach(function(category) {
        self.createChart(category);
    });
}

function bodyLoaded() {
    window.map = new Map('map', new CollisionPopup());
    window.statisticsDisplay = new StatisticsDisplay(map);
    ['oakland-2008.json',
     'oakland-2009.json',
     'oakland-2010.json',
     'oakland-2011.json',
     'oakland-2012.json',
     'oakland-2013.json'].forEach(function(url) {
        d3.json(url, function(data) {
            Collision.addFromJSON(data);
        });
    });
}

function toggleAboutDialog(show) {
    if (show) {
        document.getElementById('about').className = "active";
        document.getElementById('about_dialog').style.display = "block";
        return;
    }

    document.getElementById('about').className = "inactive";
    document.getElementById('about_dialog').style.display = "none";
}
