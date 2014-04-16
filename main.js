var ALL_YEARS = [2008, 2009, 2010, 2011, 2012];
var ALL_SEXES = ["M", "F"];
var ALL_TYPES = ["bike", "pedestrian"];
var INITIAL_MAP_CENTER = [37.8044, -122.2708];
var INITIAL_MAP_ZOOM = 13;

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
        if ( this === undefined || this === null ) {
            throw new TypeError( '"this" is null or not defined' );
        }

        var length = this.length >>> 0; // Hack to convert object.length to a UInt32
        fromIndex = +fromIndex || 0;

        if (Math.abs(fromIndex) === Infinity) {
            fromIndex = 0;
        }

        if (fromIndex < 0) {
            fromIndex += length;
        if (fromIndex < 0) {
            fromIndex = 0;
        }
    }

    for (;fromIndex < length; fromIndex++) {
        if (this[fromIndex] === searchElement) {
            return fromIndex;
        }
    }

    return -1;
    };
}

function Collision(jsonCollision) {
    var self = this;
    this.intersection = jsonCollision.intersection;
    this.date = jsonCollision.date;
    this.year = jsonCollision.year;
    this.sex = jsonCollision.sex;
    this.type = jsonCollision.type;
    this.victims = jsonCollision.victims;
    this.location = jsonCollision.location;

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
        return self.countVictims(function(victim) { return victim.injury === 1; });
    }

    this.numberOfSevereInjuries = function() {
        return self.countVictims(function(victim) { return victim.injury === 2; });
    }

    this.toString = function() {
        var result = self.intersection + " " + self.date;
        for (var v = 0; v < self.victims.length; v++) {
            var victim = self.victims[v];
            result += "\n" + victim.sex + " " + victim.age + " " + victim.injury;
        }
        return result;
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
        if (victim.sex == "F") {
            self.victimSexes[0]++;
        } else if (victim.sex == "M") {
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

function Map(mapElementID) {
    var self = this;
    this.map = L.map(mapElementID).setView(INITIAL_MAP_CENTER, INITIAL_MAP_ZOOM);
    this.map.addLayer(new L.StamenTileLayer('toner'));

    this.addCollisionGroupsToMap = function(collisionGroups) {
        for (var i = 0; i < collisionGroups.length; i++) {
            var group = collisionGroups[i];
            var size = group.length > 1 ? 40 : 20;
            var color = 'gold';

            for (var j = 0; j < group.length; j++) {
                var collision = group[j];
                if (collision.numberOfFatalities() > 0) {
                    color = 'red';
                } else if (collision.numberOfSevereInjuries() > 0 && color != 'red') {
                    color = 'purple';
                }
            }

            var marker = L.circle(group[0].location, size, {
                color: color,
                fillColor: color,
                fillOpacity: 1.0,
                opacity: 1.0,
            }).addTo(self.map).on('click', function(e) {
                var group = e.target.collisionGroup;

                var result = "";
                for (var i = 0; i < group.length; i++) {
                    result += "\n" + group[i].toString();
                }
                alert(result);
            }).collisionGroup = group;
        }
    }
}

function StatisticsDisplay() {
    var self = this;
    this.sexChart = Raphael("#sexchart", "200px", "200px");
    this.injuryChart = Raphael("#injurychart", "200px", "200px");
    this.ageChart = Raphael("#agechart", "200px", "200px");

    this.updateStatisticsDisplay = function(collisionGroups) {
        var stats = new CollisionStatistics(collisionGroups);

        self.sexChart.barchart(0, 0, 200, 100, stats.victimSexes, {})
        self.injuryChart.barchart(0, 0, 200, 100, stats.victimInjuries, {})
        self.ageChart.barchart(0, 0, 200, 100, stats.victimAges, {})
    }
}

