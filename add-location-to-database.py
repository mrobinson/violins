#!/usr/bin/env python3

import json
import os
import time
import switrs
import sqlite3
import sys

from googlegeocoder import GoogleGeocoder

class CollisionGoecoder():
    def __init__(self, city_directory):
        self.city_directory = city_directory
        self.city_name = os.path.basename(city_directory)
        self.geocoder = GoogleGeocoder()
        self.read_location_database()

    def location_database_path(self):
        return os.path.join(self.city_directory, "locations.json")

    def read_location_database(self):
        with open(self.location_database_path(), 'r') as location_file:
           self.location_database = json.loads(location_file.read())

    def write_location_database(self):
        with open(self.location_database_path(), 'w') as location_file:
           return location_file.write(json.dumps(self.location_database, sort_keys=True))

    def get_location_for_collision(self, collision):
        location_key = '{0} and {1}'.format(collision.primary_road, collision.secondary_road)
        if location_key in self.location_database:
            return self.location_database[location_key]

        try:
            time.sleep(1) # Be kind.
            search = self.geocoder.get('{0}, Oakland, CA'.format(location_key))
            self.location_database[location_key] = [search[0].geometry.location.lat, search[0].geometry.location.lng]
        except:
            return [0, 0]
        return self.location_database[location_key]

    def fill_query_results_location(self, query):
        connection = sqlite3.connect(os.path.join(self.city_directory, "all-collisions.db"))
        try:
            for row in connection.execute('SELECT * FROM collisions WHERE {0};'.format(query)):
                collision = switrs.Collision(row)
                (collision.latitude, collision.longitude) = self.get_location_for_collision(collision)
                print(collision)

            connection.commit()

        finally:
            connection.close()
            self.write_location_database()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Must specify city directory")
        sys.exit(1)

    CollisionGoecoder(sys.argv[1]).fill_query_results_location('motor_vehicle_with = "G" OR motor_vehicle_with = "B"')
