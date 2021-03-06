#!/usr/bin/env python3

# Copyright 2014 Martin Robinson
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import calendar
import collections
import datetime
import json
import os
import sqlite3
import switrs
import sys

YEARS = [2008, 2009, 2010, 2011, 2012, 2013]

def read_all_data_from_database(city_directory):
    connection = sqlite3.connect(os.path.join(city_directory, "all-collisions.db"))
    for row in connection.execute('SELECT * FROM collisions;'):
        switrs.Collision(row)
    for party in [switrs.Party(row) for row in connection.execute('SELECT * FROM parties;')]:
        switrs.Collision.collisions[party.collision_id].parties.append(party)
    for victim in [switrs.Victim(row) for row in connection.execute('SELECT * FROM victims;')]:
        switrs.Collision.collisions[victim.collision_id].victims.append(victim)
    connection.close()

def find_all_bike_and_pedestrian_collision():
    for collision in switrs.Collision.collisions.values():
        if collision.motor_vehicle_with == 'G' or collision.motor_vehicle_with == 'B':
            yield collision

def collision_type_as_number(collision):
    if collision.motor_vehicle_with == 'B': # pedestrian
        return 0
    if collision.motor_vehicle_with == 'G': # bike
        return 1
    return 2

def victim_sex_as_number(victim):
    if victim.sex == 'F':
        return 0
    if victim.sex == 'M':
        return 1
    return 2

def get_marker_index_for_collision(collision, markers):
    location = [float(collision.latitude), float(collision.longitude)]
    for (i, marker) in enumerate(markers):
        if marker == location:
            return i

    markers.append(location)
    return len(markers) - 1

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Must specify city directory")
        sys.exit(1)

    markers = []
    collisions = collections.defaultdict(lambda: [])

    read_all_data_from_database(sys.argv[1])

    for collision in find_all_bike_and_pedestrian_collision():
        victims = []
        for victim in collision.victims:
            victims.append({
                'age': int(victim.age),
                'sex': victim_sex_as_number(victim),
                'injury': int(victim.degree_of_injury),
            })

        # No clue where this time comes from, but work around it for now.
        if (collision.time == "2500"):
            collision.time = "0000"

        date = datetime.datetime.strptime(collision.date + collision.time, "%Y%m%d%H%M")
        collision = {
            'type': collision_type_as_number(collision),
            'intersection': collision.intersection_string(),
            'marker': get_marker_index_for_collision(collision, markers),
            'time': calendar.timegm(date.utctimetuple()),
            'victims': victims,
        }
        collisions[date.year].append(collision)

    for year in YEARS:
        with open(os.path.join('ui', 'oakland-' + str(year) + '.json'), 'w') as file:
            file.write(json.dumps(collisions[year]))

    with open(os.path.join('ui', 'markers.js'), 'w') as file:
        file.write('Marker.addFromJSON(' + json.dumps(markers) + ');\n')
