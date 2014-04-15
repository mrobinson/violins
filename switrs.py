def field_to_float(value):
    try:
        return float(value)
    except:
        return 0


class Collision(object):
    collisions = {}
    def __init__(self, csvarray):
        self.parties = []
        self.victims = []

        self.array = list(csvarray)
        self.id = csvarray[0]
        self.year = csvarray[1]
        self.process_date = csvarray[2]
        self.jurisdiction = csvarray[3]
        self.date = csvarray[4]
        self.time = csvarray[5]
        self.officer_id = csvarray[6]
        self.reporting_district = csvarray[7]
        self.day_of_week = csvarray[8]
        self.chp_shift = csvarray[9]
        self.population = csvarray[10]
        self.county_city_location = csvarray[11]
        self.special_condition = csvarray[12]
        self.beat_type = csvarray[13]
        self.chp_beat_type = csvarray[14]
        self.city_division_lapd = csvarray[15]
        self.chp_beat_class = csvarray[16]
        self.beat_number = csvarray[17]
        self.primary_road = csvarray[18]
        self.secondary_road = csvarray[19]
        self.distance = csvarray[20]
        self.direction = csvarray[21]
        self.intersection = csvarray[22]
        self.weather1 = csvarray[23]
        self.weather2 = csvarray[24]
        self.state_highway = csvarray[25]
        self.caltrans_county = csvarray[26]
        self.caltrans_distruct = csvarray[27]
        self.state_route = csvarray[28]
        self.route_suffix = csvarray[29]
        self.postmile_prefix = csvarray[30]
        self.postmile = csvarray[31]
        self.location_type = csvarray[32]
        self.ramp_intersection = csvarray[33]
        self.side_of_highway = csvarray[34]
        self.tow_away = csvarray[35]
        self.collision_severity = csvarray[36]
        self.killed_count = csvarray[37]
        self.injured_count = csvarray[38]
        self.party_count = csvarray[39]
        self.primary_collision_factor = csvarray[40]
        self.pcf_violation_code = csvarray[41]
        self.pcf_violation_category = csvarray[42]
        self.pcf_violation = csvarray[43]
        self.pcf_violation_subsection = csvarray[44]
        self.hit_and_run = csvarray[45]
        self.collision_type = csvarray[46]
        self.motor_vehicle_with = csvarray[47]
        self.pedestrian_action = csvarray[48]
        self.road_surface = csvarray[49]
        self.road_condition1 = csvarray[50]
        self.road_condition2 = csvarray[51]
        self.lighting = csvarray[52]
        self.control_device = csvarray[53]
        self.chp_road_type = csvarray[54]
        self.pedestrian_collision = csvarray[55]
        self.bicycle_collision = csvarray[56]
        self.motorcycle_collision = csvarray[57]
        self.truck_collision = csvarray[58]
        self.not_private_property = csvarray[59]
        self.alcohol_involved = csvarray[60]
        self.statewide_vehicle_type_at_fault = csvarray[61]
        self.chp_vehicle_type_at_fault = csvarray[62]
        self.severe_injury_count = csvarray[63]
        self.other_visible_injury_count = csvarray[64]
        self.complaint_of_pain_injury_count = csvarray[65]
        self.pedestrian_killed_count = csvarray[66]
        self.pedestrian_injured_count = csvarray[66]
        self.bicyclist_killed_count = csvarray[67]
        self.bicyclist_injured_count = csvarray[69]
        self.motorcyclist_killed_count = csvarray[70]
        self.motorcyclist_injured_count = csvarray[71]
        self.primary_ramp = csvarray[72]
        self.secondary_ramp = csvarray[73]
        self.latitude = csvarray[74]
        self.longitude = csvarray[75]

        self.__class__.collisions[self.id] = self

    def collision_with(self):
        collision_mapping = {
            'A': 'Non-collision',
            'B': 'pedestrian',
            'C': 'other motor vehicle',
            'D': 'motor vehicle on other roadway',
            'E': 'parked motor vehicle',
            'F': 'train',
            'G': 'bicycle',
            'H': 'animal',
            'I': 'fixed object',
            'J': 'other object',
            '-': 'not stated',
        }
        return collision_mapping[self.motor_vehicle_with]

    def __str__(self):
        return "{0} and {1} car/{2} at {3}, {4}".format(self.primary_road,
                                                             self.secondary_road,
                                                             self.collision_with(),
                                                             self.latitude,
                                                             self.longitude)


class Party(object):
    def __init__(self, csvarray):
        self.array = csvarray
        self.collision_id = csvarray[0]
        self.number = csvarray[1]
        self.party_type = csvarray[2]
        self.at_fault = csvarray[3]
        self.sex = csvarray[4]
        self.age = csvarray[5]
        self.sobriety = csvarray[6]
        self.impairment = csvarray[7]
        self.direction_of_travel = csvarray[8]
        self.safety_equipment1 = csvarray[9]
        self.safety_equipment2 = csvarray[10]
        self.financial_responsibility = csvarray[11]
        self.special_information1 = csvarray[12]
        self.special_information2 = csvarray[13]
        self.special_information3 = csvarray[14]
        self.oaf_violation_code = csvarray[15]
        self.oaf_violation_category = csvarray[16]
        self.oaf_violation_section = csvarray[17]
        self.oaf_violation_suffix = csvarray[18]
        self.other_associated_factor = csvarray[19]
        self.other_associated_factor2 = csvarray[20]
        self.number_killed = csvarray[21]
        self.number_injured = csvarray[22]
        self.movement_preceding_collision = csvarray[23]
        self.vehicle_year = csvarray[24]
        self.vehicle_make = csvarray[25]
        self.statewide_vehicle_type = csvarray[26]
        self.chp_vehicle_type_towing = csvarray[27]
        self.chp_vehicle_type_towed = csvarray[28]
        self.race = csvarray[29]

class Victim(object):
    def __init__(self, csvarray):
        self.array = csvarray
        self.collision_id = csvarray[0]
        self.party_id = csvarray[1]
        self.role = csvarray[2]
        self.sex = csvarray[3]
        self.age = csvarray[4]
        self.degree_of_injury = csvarray[5]
        self.seating_position = csvarray[6]
        self.safety_equipment1 = csvarray[7]
        self.safety_equipment2 = csvarray[8]
        self.ejected = csvarray[9]

