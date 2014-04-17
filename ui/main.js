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
var FILTERABLE_SEXES = ["M", "F"];
var FILTERABLE_COLLISION_TYPES = ["bike", "pedestrian"];
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

    this.numberOfFatalities = function() {
        return self.countVictims(function(victim) { return victim.isFatality(); });
    }

    this.numberOfSevereInjuries = function() {
        return self.countVictims(function(victim) { return victim.isSevereInjury(); });
    }

    this.getDateString = function() {
        return DATE_FORMAT(self.date);
    }

    this.getTimeString = function() {
        return TIME_FORMAT(self.date).toLowerCase();
    }
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
    this.injury = victimJSON.injury;
    this.age = victimJSON.age;
    this.sex = victimJSON.sex;

    this.sexString = function() {
        if (self.isMale()) {
            return "male";
        } else if (self.isFemale()) {
            return "female";
        } else {
            return "";
        }
    }

    this.ageString = function() {
        if (self.age < 150) {
            return String(self.age);
        } else {
            return "N/A";
        }
    }

    this.isMale = function () { return self.sex == "M"; }
    this.isFemale = function () { return self.sex == "F"; }
    this.isFatality = function () { return self.injury == 1; }
    this.isSevereInjury = function () { return self.injury == 2; }
}

function CollisionStatistics(collisionGroups) {
    var self = this;
    this.victimInjuries = [0, 0, 0, 0, 0];
    this.victimSexes = [0, 0, 0];
    this.victimAges = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.collisionYears = {};
    this.yearsSeen = [];

    this.processCollision = function(collision) {
        if (self.yearsSeen.indexOf(collision.year) == -1) {
            self.yearsSeen.push(collision.year);
            self.collisionYears[collision.year] = 0;
        }
        self.collisionYears[collision.year]++;
        for (var v = 0; v < collision.victims.length; v++) {
            self.processVictim(collision.victims[v]);
        }
    }

    this.processVictim = function(victim) {
        if (victim.isFemale()) {
            self.victimSexes[0]++;
        } else if (victim.isMale()) {
            self.victimSexes[1]++;
        } else {
            self.victimSexes[2]++;
        }

        self.victimInjuries[victim.injury]++;

         // Sometimes ages are unspecified by way of very large values.
        if (victim.age >= 0 && victim.age < 150) {
            var ageGroup = Math.min(Math.floor(victim.age/10), self.victimAges.length - 1);
            self.victimAges[ageGroup]++;
        }
    }

    for (var i = 0; i < collisionGroups.length; i++) {
        for (var j = 0; j < collisionGroups[i].length; j++) {
            this.processCollision(collisionGroups[i][j]);
         }
    }
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
        var years = [];
        for (var i = 0; i < FILTERABLE_YEARS.length; i++) {
            var element = document.getElementById('filter_' + FILTERABLE_YEARS[i]);
            if (element.checked)
                years.push(FILTERABLE_YEARS[i]);
        }

        var sexes = [];
        for (var i = 0; i < FILTERABLE_SEXES.length; i++) {
            var element = document.getElementById('filter_' + FILTERABLE_SEXES[i]);
            if (element.checked)
                sexes.push(FILTERABLE_SEXES[i]);
        }

        var types = [];
        for (var i = 0; i < FILTERABLE_COLLISION_TYPES.length; i++) {
            var element = document.getElementById('filter_' + FILTERABLE_COLLISION_TYPES[i]);
            if (element.checked)
                types.push(FILTERABLE_COLLISION_TYPES[i]);
        }

        self.map.removeAllMarkers();
        var collisionGroups = filterData(years, sexes, types);
        self.map.addCollisionGroupsToMap(collisionGroups);
    }

    var inputs = this.element.getElementsByTagName('input');
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].onclick = this.filterChanged.bind(this);
    }
}

function filterData(years, sexes, types) {
    var resultMap = {};
    var results = [];

    function addToResults(collision) {
        if (resultMap[collision.intersection] == undefined) {
            resultMap[collision.intersection] = [];
            results.push(resultMap[collision.intersection]);
        }

        resultMap[collision.intersection].push(collision);
    }

    for (var i = 0; i < Collision.collisions.length; i++) {
        var collision = Collision.collisions[i];
        if (years.indexOf(collision.year) == -1)
            continue;
        if (types.indexOf(collision.type) == -1)
            continue;

        var foundSex = false;
        for (var v = 0; v < collision.victims.length; v++) {
            if (sexes.indexOf(collision.victims[v].sex) != -1) {
                foundSex = true;
                break;
            }
        }
        if (!foundSex)
            continue;

        addToResults(collision);
    }
    return results;
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
            if (collision.type == "bike") {
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

    this.addCollisionGroupsToMap = function(collisionGroups) {
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

    this.updateStatisticsDisplay = function(collisionGroups) {
        var stats = new CollisionStatistics(collisionGroups);
    }
}
