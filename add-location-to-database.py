#!/usr/bin/env python3

import switrs
import sqlite3

connection = sqlite3.connect("all-collisions.db")
for row in connection.execute('SELECT * FROM collisions WHERE motor_vehicle_with = "G" OR motor_vehicle_with = "B";'):
    print(switrs.Collision(row))
connection.close()
