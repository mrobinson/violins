#!/usr/bin/env python3

import json
import os
import sqlite3
import switrs
import sys

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Must specify city directory")
        sys.exit(1)


    city_directory = sys.argv[1]
    connection = sqlite3.connect(os.path.join(city_directory, "all-collisions.db"))

    data = []
    for row in connection.execute('SELECT * FROM collisions WHERE motor_vehicle_with = "G" OR motor_vehicle_with = "B"'):
        collision = switrs.Collision(row)
        data.append([collision.latitude, collision.longitude])

    print(json.dumps(data))
