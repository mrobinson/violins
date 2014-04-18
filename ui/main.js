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

var FILTERABLE_YEARS = [2008, 2009, 2010, 2011, 2012];
var SEX_NAMES = ['Female', 'Male', 'N/A'];
var COLLISION_TYPE_NAMES = ['Bike', 'Ped.'];

var AGE_GROUP_NAMES = ['0-14', '15-24', '25-49', '50-74', '75+', 'N/A'];
var AGE_GROUP_RANGES = [14, 24, 25, 74, 150];

var INJURY_NAMES = ["None", "Fatal", "Severe", "Visible", "Other"];

var INITIAL_MAP_CENTER = [37.8044, -122.2708];
var INITIAL_MAP_ZOOM = 13;
var FATAL_COLOR = 'red';
var SEVERE_INJURY_COLOR = 'purple';
var NON_INJURY_COLOR = 'gold';

var DATE_FORMAT = d3.time.format('%b %e, %Y');
var TIME_FORMAT = d3.time.format('%_I:%M%p');

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

    this.isBikeCollision = function() { return this.type == 0; }
    this.numberOfFatalities = function() { return self.countVictims(function(victim) { return victim.isFatality(); }); }
    this.numberOfSevereInjuries = function() { return self.countVictims(function(victim) { return victim.isSevereInjury(); }); }
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
}

function Victim(victimJSON) {
    var self = this;

    this.sexString = function() {
        return SEX_NAMES[this.sex];
    }

    this.ageString = function() {
        if (self.age < 150) {
            return String(self.age);
        } else {
            return "N/A";
        }
    }

    this.calculateAgeGroup = function() {
        for (var i = 0; i < AGE_GROUP_RANGES.length; i++) {
            if (self.age <= AGE_GROUP_RANGES[i])
                return i;
        }
        return AGE_GROUP_RANGES.length;
    }

    this.isFatality = function () { return self.injury == 1; }
    this.isSevereInjury = function () { return self.injury == 2; }

    this.injury = victimJSON.injury;
    this.age = victimJSON.age;
    this.sex = victimJSON.sex;
    this.ageGroup = this.calculateAgeGroup();
}

function FilterDialog(element_id, map) {
    var self = this;
    this.element = document.getElementById(element_id);
    this.map = map;

    this.toggleVisibility = function() {
        if (self.element.style.display == "block") {
            self.element.style.display = "none";
        } else {
            self.element.style.display = "block";
        }
    }

    this.filterChanged = function() {
        self.map.removeAllMarkers();
        self.map.addCollisionsToMap(Collision.collisions);
    }

    var inputs = this.element.getElementsByTagName('input');
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].onclick = this.filterChanged.bind(this);
    }
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
                var victimString = victim.ageString() + " year old " + victim.sexString();
                if (victim.isFatality()) {
                    victimString += '<span style="color: ' + FATAL_COLOR + ';"> (FATAL)</span>';
                } else if (victim.isSevereInjury()) {
                    victimString += '<span style="color: ' + SEVERE_INJURY_COLOR + ';"> (SEVERE INJURY)</span>';
                }
                popupHTML += '<div class="victim">' + victimString + '</div>';
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
    this.map.addLayer(new L.StamenTileLayer('toner'));
    this.markers = [];

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
        for (var i = 0; i < collisionGroups.length; i++) {
            var group = collisionGroups[i];
            var size = group.length > 1 ? 40 : 20;
            var color = NON_INJURY_COLOR;

            for (var j = 0; j < group.length; j++) {
                var collision = group[j];
                if (collision.numberOfFatalities() > 0) {
                    color = FATAL_COLOR;
                } else if (collision.numberOfSevereInjuries() > 0 && color != FATAL_COLOR) {
                    color = SEVERE_INJURY_COLOR;
                }
            }

            var marker = L.circle(group[0].location, size, {
                color: color,
                fillColor: color,
                fillOpacity: 1.0,
                opacity: 1.0,
            }).addTo(self.map).on('click', function(e) {
                var popupText = self.collisionPopup.show(e.target.collisionGroup);
                var popupLocation = e.target.collisionGroup[0].location;
                var popup = L.popup().setLatLng(popupLocation).setContent(popupText).openOn(self.map);
            });
            marker.collisionGroup = group;
            self.markers.push(marker);
        }
    }
}

function StatisticsDisplay() {
    var self = this;
    this.width = 200;
    this.heightPerGroup = 20;
    this.leftMargin = 50;

    this.updateStatisticsDisplay = function(collisions) {
        var stats = new CollisionStatistics(collisions);
        self.createChart('#age_chart', stats.totalVictims, stats.ageGroupCounts, AGE_GROUP_NAMES);
        self.createChart('#sex_chart', stats.totalVictims, stats.sexCounts, SEX_NAMES);
        self.createChart('#injury_chart', stats.totalVictims, stats.injuryCounts, INJURY_NAMES);
        self.createChart('#type_chart', stats.totalCollisions, stats.typeCounts, COLLISION_TYPE_NAMES);
        self.createChart('#year_chart', stats.totalCollisions, stats.yearCounts, FILTERABLE_YEARS);
    }

    this.createChart = function(elementID, totalPossible, values, names) {
        var height = names.length * self.heightPerGroup;
        var yScale = d3.scale.ordinal()
            .domain(names)
            .rangeRoundBands([0, height], 0.05);

        var yAxis = d3.svg.axis()
            .orient("left")
            .scale(yScale)
            .tickValues(names);

        var xScale = d3.scale.linear()
            .domain([0, totalPossible])
            .range([0, self.width - self.leftMargin]);

        var chart = d3.select(elementID)
            .attr("width", self.width)
            .attr("height", height);

        chart.selectAll('.bar')
            .data(values)
                .enter().append('rect')
                    .attr('class', 'bar')
                    .attr("transform", 'translate(' + self.leftMargin + ', 0)')
                    .attr('class', 'bar')
                    .attr('y', function(d, i) { return yScale(names[i]) + 3; })
                    .attr('width', function(d) { return xScale(d); })
                    .attr('height', self.heightPerGroup - 6);

        chart.append("g")
            .attr("transform", 'translate(' + self.leftMargin + ', 0)')
            .call(yAxis);
    }
}

function CollisionStatistics(collisions) {
    var self = this;

    function arrayOfSize(size) {
        var array = Array(size);
        while (--size != -1)
            array[size] = 0;
        return array;
    }
    var sexCounts = arrayOfSize(SEX_NAMES.length);
    var yearCounts = arrayOfSize(FILTERABLE_YEARS.length);
    var typeCounts = arrayOfSize(COLLISION_TYPE_NAMES.length);
    var ageGroupCounts = arrayOfSize(AGE_GROUP_NAMES.length);
    var injuryCounts = arrayOfSize(INJURY_NAMES.length);
    var totalVictims = 0;

    collisions.forEach(function(collision) {
        typeCounts[collision.type]++;
        yearCounts[collision.year - FILTERABLE_YEARS[0]]++;
        collision.victims.forEach(function(victim) {
            totalVictims++;
            sexCounts[victim.sex]++;
            ageGroupCounts[victim.ageGroup]++;
            injuryCounts[victim.injury]++;
        });
    });

    this.sexCounts = sexCounts;
    this.ageGroupCounts = ageGroupCounts;
    this.injuryCounts = injuryCounts;
    this.yearCounts = yearCounts;
    this.typeCounts = typeCounts;
    this.totalVictims = totalVictims;
    this.totalCollisions = collisions.length;
}
