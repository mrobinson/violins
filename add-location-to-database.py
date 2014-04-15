#!/usr/bin/env python3

import json
import time
import switrs
import sqlite3

from googlegeocoder import GoogleGeocoder

def read_location_database():
    with open("locations.json", 'r') as location_file:
       return json.loads(location_file.read())

def write_location_database(new_database):
    with open("locations.json", 'w') as location_file:
       return location_file.write(json.dumps(new_database, sort_keys=True))

def get_location(collision, location_database, geocoder):
    location_key = '{0} and {1}'.format(collision.primary_road, collision.secondary_road)
    if not location_key in location_database:
        try:
            time.sleep(1) # Be kind.
            search = geocoder.get('{0}, Oakland, CA'.format(location_key))
            location_database[location_key] = [search[0].geometry.location.lat, search[0].geometry.location.lng]
            write_location_database(location_database)
        except:
            return [0, 0]
    return location_database[location_key]

def add_location_to_all_query_results(connection, query):
    location_database = read_location_database()
    geocoder = GoogleGeocoder()

    for row in connection.execute('SELECT * FROM collisions WHERE {0};'.format(query)):
        collision = switrs.Collision(row)
        (collision.latitude, collision.longitude) = get_location(collision, location_database, geocoder)
        print(collision)

    write_location_database(location_database)

connection = sqlite3.connect("all-collisions.db")
add_location_to_all_query_results(connection, 'motor_vehicle_with = "G" OR motor_vehicle_with = "B"')
connection.commit()
connection.close()
