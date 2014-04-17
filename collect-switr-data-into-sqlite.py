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

import csv
import os
import sqlite3
import switrs
import sys

def create_tables(connection):
    connection.execute('CREATE TABLE collisions(' + \
        'id text, ' + \
        'year text, ' + \
        'process_date text, ' + \
        'jurisdiction text, ' + \
        'date text, ' + \
        'time text, ' + \
        'officer_id text, ' + \
        'reporting_district text, ' + \
        'day_of_week text, ' + \
        'chp_shift text, ' + \
        'population text, ' + \
        'county_city_location text, ' + \
        'special_condition text, ' + \
        'beat_type text, ' + \
        'chp_beat_type text, ' + \
        'city_division_lapd text, ' + \
        'chp_beat_class text, ' + \
        'beat_number text, ' + \
        'primary_road text, ' + \
        'secondary_road text, ' + \
        'distance text, ' + \
        'direction text, ' + \
        'intersection text, ' + \
        'weather1 text, ' + \
        'weather2 text, ' + \
        'state_highway text, ' + \
        'caltrans_county text, ' + \
        'caltrans_distruct text, ' + \
        'state_route text, ' + \
        'route_suffix text, ' + \
        'postmile_prefix text, ' + \
        'postmile text, ' + \
        'location_type text, ' + \
        'ramp_intersection text, ' + \
        'side_of_highway text, ' + \
        'tow_away text, ' + \
        'collision_severity text, ' + \
        'killed_count text, ' + \
        'injured_count text, ' + \
        'party_count text, ' + \
        'primary_collision_factor text, ' + \
        'pcf_violation_code text, ' + \
        'pcf_violation_category text, ' + \
        'pcf_violation text, ' + \
        'pcf_violation_subsection text, ' + \
        'hit_and_run text, ' + \
        'collision_type text, ' + \
        'motor_vehicle_with text, ' + \
        'pedestrian_action text, ' + \
        'road_surface text, ' + \
        'road_condition1 text, ' + \
        'road_condition2 text, ' + \
        'lighting text, ' + \
        'control_device text, ' + \
        'chp_road_type text, ' + \
        'pedestrian_collision text, ' + \
        'bicycle_collision text, ' + \
        'motorcycle_collision text, ' + \
        'truck_collision text, ' + \
        'not_private_property text, ' + \
        'alcohol_involved text, ' + \
        'statewide_vehicle_type_at_fault text, ' + \
        'chp_vehicle_type_at_fault text, ' + \
        'severe_injury_count text, ' + \
        'other_visible_injury_count text, ' + \
        'complaint_of_pain_injury_count text, ' + \
        'pedestrian_killed_count text, ' + \
        'pedestrian_injured_count text, ' + \
        'bicyclist_killed_count text, ' + \
        'bicyclist_injured_count text, ' + \
        'motorcyclist_killed_count text, ' + \
        'motorcyclist_injured_count text, ' + \
        'primary_ramp text, ' + \
        'secondary_ramp text, ' + \
        'latitude text, ' + \
        'longitude text)')

    connection.execute('CREATE TABLE parties(' + \
        'collision_id text, ' + \
        'number text, ' + \
        'party_type text, ' + \
        'at_fault text, ' + \
        'sex text, ' + \
        'age text, ' + \
        'sobriety text, ' + \
        'impairment text, ' + \
        'direction_of_travel text, ' + \
        'safety_equipment1 text, ' + \
        'safety_equipment2 text, ' + \
        'financial_responsibility text, ' + \
        'special_information1 text, ' + \
        'special_information2 text, ' + \
        'special_information3 text, ' + \
        'oaf_violation_code text, ' + \
        'oaf_violation_category text, ' + \
        'oaf_violation_section text, ' + \
        'oaf_violation_suffix text, ' + \
        'other_associated_factor text, ' + \
        'other_associated_factor2 text, ' + \
        'number_killed text, ' + \
        'number_injured text, ' + \
        'movement_preceding_collision text, ' + \
        'vehicle_year text, ' + \
        'vehicle_make text, ' + \
        'statewide_vehicle_type text, ' + \
        'chp_vehicle_type_towing text, ' + \
        'chp_vehicle_type_towed text, ' + \
        'race text)')

    connection.execute('CREATE TABLE victims(' + \
        'collision_id text, ' + \
        'party_id text, ' + \
        'role text, ' + \
        'sex text, ' + \
        'age text, ' + \
        'degree_of_injury text, ' + \
        'seating_position text, ' + \
        'safety_equipment1 text, ' + \
        'safety_equipment2 text, ' + \
        'ejected text)')

def create_database(database_name):
    connection = sqlite3.connect(database_name)
    create_tables(connection)

    for collision in switrs.Collision.collisions.values():
        connection.execute('INSERT INTO collisions VALUES (?' + (', ?' * 75) + ')', tuple(collision.array))

        for party in collision.parties:
            # There seems to be two extra undocumented and unused fields in the Parties data.
            connection.execute('INSERT INTO parties VALUES (?' + (', ?' * 29) + ')', tuple(party.array[0:30]))
        for victim in collision.victims:
            connection.execute('INSERT INTO victims VALUES (?' + (', ?' * 9) + ')', tuple(victim.array))

    connection.commit()
    connection.close()

def read_data(filename, cls):
    with open(filename, 'r') as csvfile:
       return [cls(row) for row in csv.reader(csvfile)]

def read_data_from_directory(directory):
    print('Reading data from {0}'.format(directory))
    read_data(os.path.join(directory, 'CollisionRecords.txt'), switrs.Collision)
    for party in read_data(os.path.join(directory, 'PartyRecords.txt'), switrs.Party):
        switrs.Collision.collisions[party.collision_id].parties.append(party)
    for victim in read_data(os.path.join(directory, 'VictimRecords.txt'), switrs.Victim):
        switrs.Collision.collisions[victim.collision_id].victims.append(victim)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Must specify city directory')
        sys.exit(1)

    city_directory = sys.argv[1]
    for subdir in os.listdir(city_directory):
        subdir = os.path.join(city_directory, subdir)
        if os.path.isdir(subdir):
            read_data_from_directory(subdir)

    create_database(os.path.join(city_directory, 'all-collisions.db'))
