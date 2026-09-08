/**
 * A curated gazetteer of real cities, on top of the IANA zone list.
 *
 * `tz-places.js` knows one city per *zone* (India is only "Kolkata", China
 * only "Shanghai", the United States about a dozen). That is exactly what a
 * time zone database needs, but it is not what a world clock needs: someone in
 * Delhi, Ahmedabad or Guwahati wants to see **their** city, and someone in
 * Manchester or Dallas cannot find themselves at all, because no zone is named
 * after them.
 *
 * So this file lists cities — with their own latitude and longitude — each
 * pointing at the zone that legally covers it. Two clocks can then share a zone
 * (Delhi and Guwahati are both `Asia/Kolkata`) yet still be *different places*:
 * the coordinates drive the weather lookup and the local solar time, which is
 * the honest answer to "why does the sun feel an hour early here?".
 *
 * Rows are `[city, ISO country code, latitude, longitude, IANA zone, region]`
 * to keep the file small; `CITY_FIELDS` documents the order and
 * `expandCity()` turns a row into an object. Coordinates are rounded to four
 * decimals (≈ 11 m), which is far finer than any weather grid.
 *
 * Region codes: AF Africa · AS Asia · EU Europe · NA North & Central America
 * (plus the Caribbean) · SA South America · OC Oceania.
 */

export const CITY_FIELDS = ["city", "countryCode", "lat", "lon", "zone", "region"];

export const REGIONS = [
  { code: "AS", label: "Asia" },
  { code: "EU", label: "Europe" },
  { code: "AF", label: "Africa" },
  { code: "NA", label: "North & Central America" },
  { code: "SA", label: "South America" },
  { code: "OC", label: "Oceania" },
];

/**
 * The gazetteer. Grouped by region, alphabetical inside each country block, so
 * a human can proof-read it and a reviewer can add to it without hunting.
 */
export const CITY_ROWS = [
  /* ------------------------------------------------------------ South Asia */
  ["Delhi", "IN", 28.6139, 77.209, "Asia/Kolkata", "AS"],
  ["Mumbai", "IN", 19.076, 72.8777, "Asia/Kolkata", "AS"],
  ["Bengaluru", "IN", 12.9716, 77.5946, "Asia/Kolkata", "AS"],
  ["Chennai", "IN", 13.0827, 80.2707, "Asia/Kolkata", "AS"],
  ["Hyderabad", "IN", 17.385, 78.4867, "Asia/Kolkata", "AS"],
  ["Ahmedabad", "IN", 23.0225, 72.5714, "Asia/Kolkata", "AS"],
  ["Pune", "IN", 18.5204, 73.8567, "Asia/Kolkata", "AS"],
  ["Surat", "IN", 21.1702, 72.8311, "Asia/Kolkata", "AS"],
  ["Jaipur", "IN", 26.9124, 75.7873, "Asia/Kolkata", "AS"],
  ["Lucknow", "IN", 26.8467, 80.9462, "Asia/Kolkata", "AS"],
  ["Kanpur", "IN", 26.4499, 80.3319, "Asia/Kolkata", "AS"],
  ["Nagpur", "IN", 21.1458, 79.0882, "Asia/Kolkata", "AS"],
  ["Patna", "IN", 25.5941, 85.1376, "Asia/Kolkata", "AS"],
  ["Indore", "IN", 22.7196, 75.8577, "Asia/Kolkata", "AS"],
  ["Bhopal", "IN", 23.2599, 77.4126, "Asia/Kolkata", "AS"],
  ["Vadodara", "IN", 22.3072, 73.1812, "Asia/Kolkata", "AS"],
  ["Coimbatore", "IN", 11.0168, 76.9558, "Asia/Kolkata", "AS"],
  ["Kochi", "IN", 9.9312, 76.2673, "Asia/Kolkata", "AS"],
  ["Visakhapatnam", "IN", 17.6868, 83.2185, "Asia/Kolkata", "AS"],
  ["Chandigarh", "IN", 30.7333, 76.7794, "Asia/Kolkata", "AS"],
  ["Guwahati", "IN", 26.1445, 91.7362, "Asia/Kolkata", "AS"],
  ["Imphal", "IN", 24.817, 93.9368, "Asia/Kolkata", "AS"],
  ["Shillong", "IN", 25.5788, 91.8933, "Asia/Kolkata", "AS"],
  ["Aizawl", "IN", 23.7271, 92.7176, "Asia/Kolkata", "AS"],
  ["Gangtok", "IN", 27.3314, 88.6138, "Asia/Kolkata", "AS"],
  ["Itanagar", "IN", 27.0844, 93.6053, "Asia/Kolkata", "AS"],
  ["Agartala", "IN", 23.8315, 91.2868, "Asia/Kolkata", "AS"],
  ["Kohima", "IN", 25.6751, 94.1086, "Asia/Kolkata", "AS"],
  ["Srinagar", "IN", 34.0837, 74.7973, "Asia/Kolkata", "AS"],
  ["Jammu", "IN", 32.7266, 74.857, "Asia/Kolkata", "AS"],
  ["Leh", "IN", 34.1526, 77.5771, "Asia/Kolkata", "AS"],
  ["Amritsar", "IN", 31.634, 74.8723, "Asia/Kolkata", "AS"],
  ["Thiruvananthapuram", "IN", 8.5241, 76.9366, "Asia/Kolkata", "AS"],
  ["Kozhikode", "IN", 11.2588, 75.7804, "Asia/Kolkata", "AS"],
  ["Madurai", "IN", 9.9252, 78.1198, "Asia/Kolkata", "AS"],
  ["Tiruchirappalli", "IN", 10.7905, 78.7047, "Asia/Kolkata", "AS"],
  ["Mysuru", "IN", 12.2958, 76.6394, "Asia/Kolkata", "AS"],
  ["Mangaluru", "IN", 12.9141, 74.856, "Asia/Kolkata", "AS"],
  ["Hubballi", "IN", 15.3647, 75.124, "Asia/Kolkata", "AS"],
  ["Panaji", "IN", 15.4909, 73.8278, "Asia/Kolkata", "AS"],
  ["Nashik", "IN", 19.9975, 73.7898, "Asia/Kolkata", "AS"],
  ["Aurangabad", "IN", 19.8762, 75.3433, "Asia/Kolkata", "AS"],
  ["Rajkot", "IN", 22.3039, 70.8022, "Asia/Kolkata", "AS"],
  ["Bhubaneswar", "IN", 20.2961, 85.8245, "Asia/Kolkata", "AS"],
  ["Ranchi", "IN", 23.3441, 85.3096, "Asia/Kolkata", "AS"],
  ["Raipur", "IN", 21.2514, 81.6296, "Asia/Kolkata", "AS"],
  ["Dehradun", "IN", 30.3165, 78.0322, "Asia/Kolkata", "AS"],
  ["Shimla", "IN", 31.1048, 77.1734, "Asia/Kolkata", "AS"],
  ["Jodhpur", "IN", 26.2389, 73.0243, "Asia/Kolkata", "AS"],
  ["Udaipur", "IN", 24.5854, 73.7125, "Asia/Kolkata", "AS"],
  ["Agra", "IN", 27.1767, 78.0081, "Asia/Kolkata", "AS"],
  ["Varanasi", "IN", 25.3176, 82.9739, "Asia/Kolkata", "AS"],
  ["Gwalior", "IN", 26.2183, 78.1828, "Asia/Kolkata", "AS"],
  ["Jabalpur", "IN", 23.1815, 79.9864, "Asia/Kolkata", "AS"],
  ["Siliguri", "IN", 26.7271, 88.3953, "Asia/Kolkata", "AS"],
  ["Dibrugarh", "IN", 27.4728, 94.912, "Asia/Kolkata", "AS"],
  ["Port Blair", "IN", 11.6234, 92.7265, "Asia/Kolkata", "AS"],
  ["Kavaratti", "IN", 10.5669, 72.642, "Asia/Kolkata", "AS"],
  ["Puducherry", "IN", 11.9416, 79.8083, "Asia/Kolkata", "AS"],

  ["Karachi", "PK", 24.8607, 67.0011, "Asia/Karachi", "AS"],
  ["Lahore", "PK", 31.5497, 74.3436, "Asia/Karachi", "AS"],
  ["Islamabad", "PK", 33.6844, 73.0479, "Asia/Karachi", "AS"],
  ["Faisalabad", "PK", 31.4504, 73.135, "Asia/Karachi", "AS"],
  ["Multan", "PK", 30.1575, 71.5249, "Asia/Karachi", "AS"],
  ["Peshawar", "PK", 34.0151, 71.5249, "Asia/Karachi", "AS"],
  ["Quetta", "PK", 30.1798, 66.975, "Asia/Karachi", "AS"],

  ["Chittagong", "BD", 22.3569, 91.7832, "Asia/Dhaka", "AS"],
  ["Sylhet", "BD", 24.8949, 91.8687, "Asia/Dhaka", "AS"],
  ["Khulna", "BD", 22.8095, 89.5749, "Asia/Dhaka", "AS"],
  ["Rajshahi", "BD", 24.3745, 88.6042, "Asia/Dhaka", "AS"],

  ["Pokhara", "NP", 28.2096, 83.9856, "Asia/Kathmandu", "AS"],
  ["Biratnagar", "NP", 26.4525, 87.2718, "Asia/Kathmandu", "AS"],
  ["Birgunj", "NP", 27.0041, 84.8733, "Asia/Kathmandu", "AS"],

  ["Jaffna", "LK", 9.6615, 80.0255, "Asia/Colombo", "AS"],
  ["Kandy", "LK", 7.2906, 80.6337, "Asia/Colombo", "AS"],
  ["Galle", "LK", 6.0535, 80.221, "Asia/Colombo", "AS"],

  ["Malé", "MV", 4.1755, 73.5093, "Indian/Maldives", "AS"],
  ["Kandahar", "AF", 31.6133, 65.7101, "Asia/Kabul", "AS"],
  ["Herat", "AF", 34.3482, 62.1997, "Asia/Kabul", "AS"],
  ["Mazar-i-Sharif", "AF", 36.7081, 67.1101, "Asia/Kabul", "AS"],

  /* ------------------------------------------------ Central & western Asia */
  ["Astana", "KZ", 51.1694, 71.4491, "Asia/Almaty", "AS"],
  ["Shymkent", "KZ", 42.3417, 69.5901, "Asia/Almaty", "AS"],
  ["Karaganda", "KZ", 49.8047, 73.1094, "Asia/Almaty", "AS"],
  ["Aktobe", "KZ", 50.2839, 57.167, "Asia/Aqtobe", "AS"],
  ["Bukhara", "UZ", 39.7683, 64.4286, "Asia/Samarkand", "AS"],
  ["Andijan", "UZ", 40.7821, 72.3442, "Asia/Tashkent", "AS"],
  ["Osh", "KG", 40.5283, 72.7985, "Asia/Bishkek", "AS"],
  ["Turkmenbashi", "TM", 40.0232, 52.9663, "Asia/Ashgabat", "AS"],
  ["Ganja", "AZ", 40.6828, 46.3606, "Asia/Baku", "AS"],
  ["Batumi", "GE", 41.6424, 41.6338, "Asia/Tbilisi", "AS"],
  ["Gyumri", "AM", 40.7894, 43.8453, "Asia/Yerevan", "AS"],

  /* ----------------------------------------------------------- Middle East */
  ["Abu Dhabi", "AE", 24.4539, 54.3773, "Asia/Dubai", "AS"],
  ["Sharjah", "AE", 25.3374, 55.4121, "Asia/Dubai", "AS"],
  ["Doha", "QA", 25.2854, 51.531, "Asia/Qatar", "AS"],
  ["Jeddah", "SA", 21.4858, 39.1925, "Asia/Riyadh", "AS"],
  ["Mecca", "SA", 21.3891, 39.8579, "Asia/Riyadh", "AS"],
  ["Medina", "SA", 24.4686, 39.6142, "Asia/Riyadh", "AS"],
  ["Dammam", "SA", 26.3927, 49.9777, "Asia/Riyadh", "AS"],
  ["Kuwait City", "KW", 29.3759, 47.9774, "Asia/Kuwait", "AS"],
  ["Manama", "BH", 26.2285, 50.586, "Asia/Bahrain", "AS"],
  ["Muscat", "OM", 23.5859, 58.4059, "Asia/Muscat", "AS"],
  ["Salalah", "OM", 17.0151, 54.0924, "Asia/Muscat", "AS"],
  ["Sanaa", "YE", 15.3694, 44.191, "Asia/Aden", "AS"],
  ["Basra", "IQ", 30.5085, 47.7804, "Asia/Baghdad", "AS"],
  ["Mosul", "IQ", 36.3489, 43.1496, "Asia/Baghdad", "AS"],
  ["Erbil", "IQ", 36.1911, 44.0092, "Asia/Baghdad", "AS"],
  ["Mashhad", "IR", 36.2972, 59.6067, "Asia/Tehran", "AS"],
  ["Shiraz", "IR", 29.5918, 52.5837, "Asia/Tehran", "AS"],
  ["Isfahan", "IR", 32.6525, 51.6746, "Asia/Tehran", "AS"],
  ["Tabriz", "IR", 38.0792, 46.2887, "Asia/Tehran", "AS"],
  ["Jerusalem", "IL", 31.7683, 35.2137, "Asia/Jerusalem", "AS"],
  ["Tel Aviv", "IL", 32.0853, 34.7818, "Asia/Jerusalem", "AS"],
  ["Haifa", "IL", 32.794, 34.9896, "Asia/Jerusalem", "AS"],
  ["Aleppo", "SY", 36.2021, 37.1343, "Asia/Damascus", "AS"],
  ["Aqaba", "JO", 29.5267, 35.0078, "Asia/Amman", "AS"],
  ["Ankara", "TR", 39.9334, 32.8597, "Europe/Istanbul", "AS"],
  ["Izmir", "TR", 38.4237, 27.1428, "Europe/Istanbul", "AS"],
  ["Antalya", "TR", 36.8969, 30.7133, "Europe/Istanbul", "AS"],

  /* --------------------------------------------------------- East / SE Asia */
  ["Beijing", "CN", 39.9042, 116.4074, "Asia/Shanghai", "AS"],
  ["Guangzhou", "CN", 23.1291, 113.2644, "Asia/Shanghai", "AS"],
  ["Shenzhen", "CN", 22.5431, 114.0579, "Asia/Shanghai", "AS"],
  ["Chengdu", "CN", 30.5728, 104.0668, "Asia/Shanghai", "AS"],
  ["Xi'an", "CN", 34.3416, 108.9398, "Asia/Shanghai", "AS"],
  ["Hangzhou", "CN", 30.2741, 120.1551, "Asia/Shanghai", "AS"],
  ["Wuhan", "CN", 30.5928, 114.3055, "Asia/Shanghai", "AS"],
  ["Tianjin", "CN", 39.3434, 117.3616, "Asia/Shanghai", "AS"],
  ["Chongqing", "CN", 29.563, 106.5516, "Asia/Shanghai", "AS"],
  ["Shenyang", "CN", 41.8057, 123.4315, "Asia/Shanghai", "AS"],
  ["Harbin", "CN", 45.8038, 126.5349, "Asia/Shanghai", "AS"],
  ["Kunming", "CN", 25.0389, 102.7183, "Asia/Shanghai", "AS"],
  ["Lhasa", "CN", 29.652, 91.1721, "Asia/Shanghai", "AS"],
  ["Kashgar", "CN", 39.4704, 75.9898, "Asia/Urumqi", "AS"],
  ["Kaohsiung", "TW", 22.6273, 120.3014, "Asia/Taipei", "AS"],
  ["Taichung", "TW", 24.1477, 120.6736, "Asia/Taipei", "AS"],

  ["Osaka", "JP", 34.6937, 135.5023, "Asia/Tokyo", "AS"],
  ["Kyoto", "JP", 35.0116, 135.7681, "Asia/Tokyo", "AS"],
  ["Nagoya", "JP", 35.1815, 136.9066, "Asia/Tokyo", "AS"],
  ["Sapporo", "JP", 43.0618, 141.3545, "Asia/Tokyo", "AS"],
  ["Fukuoka", "JP", 33.5904, 130.4017, "Asia/Tokyo", "AS"],
  ["Naha", "JP", 26.2124, 127.6809, "Asia/Tokyo", "AS"],
  ["Busan", "KR", 35.1151, 129.0422, "Asia/Seoul", "AS"],
  ["Incheon", "KR", 37.4563, 126.7052, "Asia/Seoul", "AS"],
  ["Jeju", "KR", 33.4996, 126.5312, "Asia/Seoul", "AS"],

  ["Hanoi", "VN", 21.0285, 105.8542, "Asia/Ho_Chi_Minh", "AS"],
  ["Da Nang", "VN", 16.0544, 108.2022, "Asia/Ho_Chi_Minh", "AS"],
  ["Siem Reap", "KH", 13.3671, 103.8448, "Asia/Bangkok", "AS"],
  ["Luang Prabang", "LA", 19.8564, 102.1351, "Asia/Bangkok", "AS"],
  ["Chiang Mai", "TH", 18.7883, 98.9853, "Asia/Bangkok", "AS"],
  ["Phuket", "TH", 7.8804, 98.3923, "Asia/Bangkok", "AS"],
  ["Mandalay", "MM", 21.9588, 96.0891, "Asia/Yangon", "AS"],
  ["Naypyidaw", "MM", 19.7633, 96.0785, "Asia/Yangon", "AS"],
  ["George Town", "MY", 5.4141, 100.3288, "Asia/Kuala_Lumpur", "AS"],
  ["Johor Bahru", "MY", 1.4927, 103.7414, "Asia/Kuala_Lumpur", "AS"],
  ["Kota Kinabalu", "MY", 5.9804, 116.0735, "Asia/Kuching", "AS"],
  ["Surabaya", "ID", -7.2575, 112.7521, "Asia/Jakarta", "AS"],
  ["Medan", "ID", 3.5952, 98.6722, "Asia/Jakarta", "AS"],
  ["Denpasar", "ID", -8.6705, 115.2126, "Asia/Makassar", "AS"],
  ["Cebu City", "PH", 10.3157, 123.8854, "Asia/Manila", "AS"],
  ["Davao", "PH", 7.0731, 125.6128, "Asia/Manila", "AS"],

  /* ----------------------------------------------------------------- Russia */
  ["Saint Petersburg", "RU", 59.9311, 30.3609, "Europe/Moscow", "EU"],
  ["Kazan", "RU", 55.7963, 49.1064, "Europe/Moscow", "EU"],
  ["Sochi", "RU", 43.5992, 39.7257, "Europe/Moscow", "EU"],
  ["Murmansk", "RU", 68.9585, 33.0827, "Europe/Moscow", "EU"],
  ["Chelyabinsk", "RU", 55.1644, 61.4368, "Asia/Yekaterinburg", "EU"],
];

/** Rows 2 — Europe, the Americas, Africa and Oceania live in their own list so
 * the file stays readable; `CITY_ROWS` above and this one are concatenated. */
export const CITY_ROWS_MORE = [
  /* ------------------------------------------------------- British Isles */
  ["Manchester", "GB", 53.4808, -2.2426, "Europe/London", "EU"],
  ["Birmingham", "GB", 52.4862, -1.8904, "Europe/London", "EU"],
  ["Glasgow", "GB", 55.8642, -4.2518, "Europe/London", "EU"],
  ["Edinburgh", "GB", 55.9533, -3.1883, "Europe/London", "EU"],
  ["Liverpool", "GB", 53.4084, -2.9916, "Europe/London", "EU"],
  ["Bristol", "GB", 51.4545, -2.5879, "Europe/London", "EU"],
  ["Cardiff", "GB", 51.4816, -3.1791, "Europe/London", "EU"],
  ["Belfast", "GB", 54.5973, -5.9301, "Europe/London", "EU"],
  ["Cork", "IE", 51.8985, -8.4756, "Europe/Dublin", "EU"],
  ["Galway", "IE", 53.2719, -9.0489, "Europe/Dublin", "EU"],

  /* -------------------------------------------------------- Western Europe */
  ["Lyon", "FR", 45.764, 4.8357, "Europe/Paris", "EU"],
  ["Marseille", "FR", 43.2965, 5.3698, "Europe/Paris", "EU"],
  ["Nice", "FR", 43.7102, 7.262, "Europe/Paris", "EU"],
  ["Bordeaux", "FR", 44.8378, -0.5792, "Europe/Paris", "EU"],
  ["Toulouse", "FR", 43.6047, 1.4442, "Europe/Paris", "EU"],
  ["Strasbourg", "FR", 48.5734, 7.7521, "Europe/Paris", "EU"],
  ["Munich", "DE", 48.1351, 11.582, "Europe/Berlin", "EU"],
  ["Hamburg", "DE", 53.5511, 9.9937, "Europe/Berlin", "EU"],
  ["Frankfurt", "DE", 50.1109, 8.6821, "Europe/Berlin", "EU"],
  ["Cologne", "DE", 50.9375, 6.9603, "Europe/Berlin", "EU"],
  ["Stuttgart", "DE", 48.7758, 9.1829, "Europe/Berlin", "EU"],
  ["Düsseldorf", "DE", 51.2277, 6.7735, "Europe/Berlin", "EU"],
  ["Rotterdam", "NL", 51.9244, 4.4777, "Europe/Amsterdam", "EU"],
  ["Utrecht", "NL", 52.0907, 5.1214, "Europe/Amsterdam", "EU"],
  ["Eindhoven", "NL", 51.4416, 5.4697, "Europe/Amsterdam", "EU"],
  ["Antwerp", "BE", 51.2194, 4.4025, "Europe/Brussels", "EU"],
  ["Ghent", "BE", 51.05, 3.7167, "Europe/Brussels", "EU"],
  ["Geneva", "CH", 46.2044, 6.1432, "Europe/Zurich", "EU"],
  ["Bern", "CH", 46.948, 7.4474, "Europe/Zurich", "EU"],
  ["Basel", "CH", 47.5596, 7.5886, "Europe/Zurich", "EU"],
  ["Salzburg", "AT", 47.8095, 13.055, "Europe/Vienna", "EU"],
  ["Graz", "AT", 47.0707, 15.4395, "Europe/Vienna", "EU"],
  ["Innsbruck", "AT", 47.2692, 11.4041, "Europe/Vienna", "EU"],

  /* ------------------------------------------------------ Southern Europe */
  ["Milan", "IT", 45.4642, 9.19, "Europe/Rome", "EU"],
  ["Naples", "IT", 40.8518, 14.2681, "Europe/Rome", "EU"],
  ["Venice", "IT", 45.4408, 12.3155, "Europe/Rome", "EU"],
  ["Florence", "IT", 43.7696, 11.2558, "Europe/Rome", "EU"],
  ["Turin", "IT", 45.0703, 7.6869, "Europe/Rome", "EU"],
  ["Palermo", "IT", 38.1157, 13.3615, "Europe/Rome", "EU"],
  ["Barcelona", "ES", 41.3874, 2.1686, "Europe/Madrid", "EU"],
  ["Valencia", "ES", 39.4699, -0.3763, "Europe/Madrid", "EU"],
  ["Seville", "ES", 37.3891, -5.9845, "Europe/Madrid", "EU"],
  ["Bilbao", "ES", 43.263, -2.935, "Europe/Madrid", "EU"],
  ["Málaga", "ES", 36.7213, -4.4214, "Europe/Madrid", "EU"],
  ["Palma", "ES", 39.5696, 2.6502, "Europe/Madrid", "EU"],
  ["Las Palmas", "ES", 28.1248, -15.43, "Atlantic/Canary", "EU"],
  ["Porto", "PT", 41.1579, -8.6291, "Europe/Lisbon", "EU"],
  ["Funchal", "PT", 32.6669, -16.9241, "Atlantic/Madeira", "EU"],
  ["Ponta Delgada", "PT", 37.7412, -25.6756, "Atlantic/Azores", "EU"],
  ["Thessaloniki", "GR", 40.6401, 22.9444, "Europe/Athens", "EU"],
  ["Heraklion", "GR", 35.3279, 25.1403, "Europe/Athens", "EU"],
  ["Valletta", "MT", 35.8989, 14.5146, "Europe/Malta", "EU"],

  /* ------------------------------------------------- Central & eastern Europe */
  ["Kraków", "PL", 50.0647, 19.945, "Europe/Warsaw", "EU"],
  ["Gdańsk", "PL", 54.352, 18.6466, "Europe/Warsaw", "EU"],
  ["Wrocław", "PL", 51.1079, 17.0385, "Europe/Warsaw", "EU"],
  ["Brno", "CZ", 49.1951, 16.6068, "Europe/Prague", "EU"],
  ["Ostrava", "CZ", 49.8344, 18.2820, "Europe/Prague", "EU"],
  ["Debrecen", "HU", 47.531, 21.6243, "Europe/Budapest", "EU"],
  ["Varna", "BG", 43.2072, 27.9482, "Europe/Sofia", "EU"],
  ["Cluj-Napoca", "RO", 46.7712, 23.6236, "Europe/Bucharest", "EU"],
  ["Lviv", "UA", 49.8397, 24.0297, "Europe/Kyiv", "EU"],
  ["Odesa", "UA", 46.4825, 30.7233, "Europe/Kyiv", "EU"],
  ["Kharkiv", "UA", 49.9935, 36.2304, "Europe/Kyiv", "EU"],
  ["Kaunas", "LT", 54.8985, 23.9036, "Europe/Vilnius", "EU"],
  ["Tartu", "EE", 58.3776, 26.729, "Europe/Tallinn", "EU"],

  /* ----------------------------------------------------------- Nordic region */
  ["Aarhus", "DK", 56.1629, 10.2039, "Europe/Copenhagen", "EU"],
  ["Gothenburg", "SE", 57.7089, 11.9746, "Europe/Stockholm", "EU"],
  ["Malmö", "SE", 55.605, 13.0038, "Europe/Stockholm", "EU"],
  ["Umeå", "SE", 63.8258, 20.263, "Europe/Stockholm", "EU"],
  ["Bergen", "NO", 60.3913, 5.3221, "Europe/Oslo", "EU"],
  ["Trondheim", "NO", 63.4305, 10.3951, "Europe/Oslo", "EU"],
  ["Tromsø", "NO", 69.6492, 18.9553, "Europe/Oslo", "EU"],
  ["Tampere", "FI", 61.4978, 23.761, "Europe/Helsinki", "EU"],
  ["Oulu", "FI", 65.0121, 25.4651, "Europe/Helsinki", "EU"],
  ["Akureyri", "IS", 65.6835, -18.0878, "Atlantic/Reykjavik", "EU"],

  /* ------------------------------------------------------ Northern America */
  ["Houston", "US", 29.7604, -95.3698, "America/Chicago", "NA"],
  ["Philadelphia", "US", 39.9526, -75.1652, "America/New_York", "NA"],
  ["San Antonio", "US", 29.4241, -98.4936, "America/Chicago", "NA"],
  ["San Diego", "US", 32.7157, -117.1611, "America/Los_Angeles", "NA"],
  ["Dallas", "US", 32.7767, -96.797, "America/Chicago", "NA"],
  ["San Jose", "US", 37.3382, -121.8863, "America/Los_Angeles", "NA"],
  ["Austin", "US", 30.2672, -97.7431, "America/Chicago", "NA"],
  ["Jacksonville", "US", 30.3322, -81.6557, "America/New_York", "NA"],
  ["San Francisco", "US", 37.7749, -122.4194, "America/Los_Angeles", "NA"],
  ["Seattle", "US", 47.6062, -122.3321, "America/Los_Angeles", "NA"],
  ["Denver", "US", 39.7392, -104.9903, "America/Denver", "NA"],
  ["Boston", "US", 42.3601, -71.0589, "America/New_York", "NA"],
  ["Las Vegas", "US", 36.1699, -115.1398, "America/Los_Angeles", "NA"],
  ["Miami", "US", 25.7617, -80.1918, "America/New_York", "NA"],
  ["Atlanta", "US", 33.749, -84.388, "America/New_York", "NA"],
  ["Minneapolis", "US", 44.9778, -93.265, "America/Chicago", "NA"],
  ["Salt Lake City", "US", 40.7608, -111.891, "America/Denver", "NA"],
  ["Portland", "US", 45.5152, -122.6784, "America/Los_Angeles", "NA"],
  ["New Orleans", "US", 29.9511, -90.0715, "America/Chicago", "NA"],
  ["Nashville", "US", 36.1627, -86.7816, "America/Chicago", "NA"],
  ["Washington", "US", 38.9072, -77.0369, "America/New_York", "NA"],
  ["Charlotte", "US", 35.2271, -80.8431, "America/New_York", "NA"],
  ["Pittsburgh", "US", 40.4406, -79.9959, "America/New_York", "NA"],
  ["St. Louis", "US", 38.627, -90.1994, "America/Chicago", "NA"],
  ["Kansas City", "US", 39.0997, -94.5786, "America/Chicago", "NA"],
  ["Albuquerque", "US", 35.0844, -106.6504, "America/Denver", "NA"],
  ["Columbus", "US", 39.9612, -82.9988, "America/New_York", "NA"],
  ["Fairbanks", "US", 64.8378, -147.7164, "America/Anchorage", "NA"],
  ["Hilo", "US", 19.7297, -155.09, "Pacific/Honolulu", "NA"],

  ["Montreal", "CA", 45.5019, -73.5674, "America/Toronto", "NA"],
  ["Calgary", "CA", 51.0447, -114.0719, "America/Edmonton", "NA"],
  ["Ottawa", "CA", 45.4215, -75.6972, "America/Toronto", "NA"],
  ["Quebec City", "CA", 46.8139, -71.208, "America/Toronto", "NA"],
  ["Victoria", "CA", 48.4284, -123.3656, "America/Vancouver", "NA"],
  ["Saskatoon", "CA", 52.1332, -106.6700, "America/Regina", "NA"],

  ["Guadalajara", "MX", 20.6597, -103.3496, "America/Mexico_City", "NA"],
  ["Monterrey", "MX", 25.6866, -100.3161, "America/Monterrey", "NA"],
  ["Puebla", "MX", 19.0413, -98.2063, "America/Mexico_City", "NA"],
  ["León", "MX", 21.125, -101.686, "America/Mexico_City", "NA"],
  ["Oaxaca", "MX", 17.0732, -96.7266, "America/Mexico_City", "NA"],

  ["Kingston", "JM", 17.9714, -76.7931, "America/Jamaica", "NA"],
  ["San Juan", "PR", 18.4655, -66.1057, "America/Puerto_Rico", "NA"],
  ["San José", "CR", 9.9281, -84.0907, "America/Costa_Rica", "NA"],
  ["Panama City", "PA", 8.9824, -79.5199, "America/Panama", "NA"],
  ["Belize City", "BZ", 17.5046, -88.1962, "America/Belize", "NA"],
  ["Guatemala City", "GT", 14.6349, -90.5069, "America/Guatemala", "NA"],

  /* -------------------------------------------------------- South America */
  ["Bogotá", "CO", 4.711, -74.0721, "America/Bogota", "SA"],
  ["Medellín", "CO", 6.2442, -75.5812, "America/Bogota", "SA"],
  ["Cali", "CO", 3.4516, -76.532, "America/Bogota", "SA"],
  ["Cartagena", "CO", 10.391, -75.4794, "America/Bogota", "SA"],
  ["Lima", "PE", -12.0464, -77.0428, "America/Lima", "SA"],
  ["Cusco", "PE", -13.5319, -71.9675, "America/Lima", "SA"],
  ["Arequipa", "PE", -16.409, -71.5375, "America/Lima", "SA"],
  ["Quito", "EC", -0.1807, -78.4678, "America/Guayaquil", "SA"],
  ["Cuenca", "EC", -2.9001, -79.0059, "America/Guayaquil", "SA"],
  ["La Paz", "BO", -16.4897, -68.1193, "America/La_Paz", "SA"],
  ["Santa Cruz", "BO", -17.7863, -63.1812, "America/La_Paz", "SA"],
  ["Córdoba", "AR", -31.4201, -64.1888, "America/Argentina/Cordoba", "SA"],
  ["Rosario", "AR", -32.9468, -60.6393, "America/Argentina/Buenos_Aires", "SA"],
  ["Salta", "AR", -24.7859, -65.4117, "America/Argentina/Salta", "SA"],
  ["Valparaíso", "CL", -33.0472, -71.6127, "America/Santiago", "SA"],
  ["Concepción", "CL", -36.827, -73.0498, "America/Santiago", "SA"],
  ["Rio de Janeiro", "BR", -22.9068, -43.1729, "America/Sao_Paulo", "SA"],
  ["Brasília", "BR", -15.7939, -47.8828, "America/Sao_Paulo", "SA"],
  ["Salvador", "BR", -12.9777, -38.5016, "America/Sao_Paulo", "SA"],
  ["Belo Horizonte", "BR", -19.9167, -43.9345, "America/Sao_Paulo", "SA"],
  ["Porto Alegre", "BR", -30.0346, -51.2177, "America/Sao_Paulo", "SA"],
  ["Curitiba", "BR", -25.4284, -49.2733, "America/Sao_Paulo", "SA"],
  ["Maracaibo", "VE", 10.6427, -71.6125, "America/Caracas", "SA"],
  ["Georgetown", "GY", 6.8013, -58.1551, "America/Guyana", "SA"],

  /* --------------------------------------------------------------- Africa */
  ["Alexandria", "EG", 31.2001, 29.9187, "Africa/Cairo", "AF"],
  ["Aswan", "EG", 24.0909, 32.8994, "Africa/Cairo", "AF"],
  ["Abuja", "NG", 9.0765, 7.3986, "Africa/Lagos", "AF"],
  ["Kano", "NG", 12.0022, 8.592, "Africa/Lagos", "AF"],
  ["Ibadan", "NG", 7.3775, 3.947, "Africa/Lagos", "AF"],
  ["Port Harcourt", "NG", 4.8156, 7.0498, "Africa/Lagos", "AF"],
  ["Kumasi", "GH", 6.6885, -1.6244, "Africa/Accra", "AF"],
  ["Tamale", "GH", 9.4075, -0.8538, "Africa/Accra", "AF"],
  ["Mombasa", "KE", -4.0435, 39.6682, "Africa/Nairobi", "AF"],
  ["Kisumu", "KE", -0.1022, 34.7617, "Africa/Nairobi", "AF"],
  ["Zanzibar City", "TZ", -6.1659, 39.2026, "Africa/Dar_es_Salaam", "AF"],
  ["Arusha", "TZ", -3.3869, 36.683, "Africa/Dar_es_Salaam", "AF"],
  ["Benghazi", "LY", 32.1167, 20.0667, "Africa/Tripoli", "AF"],
  ["Sfax", "TN", 34.7406, 10.7603, "Africa/Tunis", "AF"],
  ["Oran", "DZ", 35.6971, -0.6359, "Africa/Algiers", "AF"],
  ["Constantine", "DZ", 36.365, 6.6147, "Africa/Algiers", "AF"],
  ["Marrakesh", "MA", 31.6295, -7.9811, "Africa/Casablanca", "AF"],
  ["Rabat", "MA", 34.0209, -6.8416, "Africa/Casablanca", "AF"],
  ["Tangier", "MA", 35.7595, -5.834, "Africa/Casablanca", "AF"],
  ["Fès", "MA", 34.0181, -5.0078, "Africa/Casablanca", "AF"],
  ["Yaoundé", "CM", 3.848, 11.5021, "Africa/Douala", "AF"],
  ["Cape Town", "ZA", -33.9249, 18.4241, "Africa/Johannesburg", "AF"],
  ["Durban", "ZA", -29.8587, 31.0218, "Africa/Johannesburg", "AF"],
  ["Pretoria", "ZA", -25.7479, 28.2293, "Africa/Johannesburg", "AF"],
  ["Bloemfontein", "ZA", -29.0852, 26.1596, "Africa/Johannesburg", "AF"],
  ["Gqeberha", "ZA", -33.9608, 25.6022, "Africa/Johannesburg", "AF"],
  ["Port Louis", "MU", -20.1609, 57.5012, "Indian/Mauritius", "AF"],
  ["Victoria", "SC", -4.62, 55.45, "Indian/Mahe", "AF"],
  ["Praia", "CV", 14.9331, -23.5133, "Atlantic/Cape_Verde", "AF"],

  /* -------------------------------------------------------------- Oceania */
  ["Canberra", "AU", -35.2809, 149.13, "Australia/Sydney", "OC"],
  ["Newcastle", "AU", -32.9283, 151.7817, "Australia/Sydney", "OC"],
  ["Gold Coast", "AU", -28.0167, 153.4, "Australia/Brisbane", "OC"],
  ["Cairns", "AU", -16.9186, 145.7781, "Australia/Brisbane", "OC"],
  ["Townsville", "AU", -19.259, 146.8169, "Australia/Brisbane", "OC"],
  ["Wellington", "NZ", -41.2866, 174.7756, "Pacific/Auckland", "OC"],
  ["Christchurch", "NZ", -43.5321, 172.6362, "Pacific/Auckland", "OC"],
  ["Hamilton", "NZ", -37.787, 175.2793, "Pacific/Auckland", "OC"],
  ["Dunedin", "NZ", -45.8788, 170.5028, "Pacific/Auckland", "OC"],
  ["Queenstown", "NZ", -45.0312, 168.6626, "Pacific/Auckland", "OC"],
  ["Suva", "FJ", -18.1248, 178.4501, "Pacific/Fiji", "OC"],
  ["Nadi", "FJ", -17.7765, 177.4226, "Pacific/Fiji", "OC"],
  ["Lae", "PG", -6.7364, 146.9955, "Pacific/Port_Moresby", "OC"],
  ["Papeete", "PF", -17.5516, -149.5585, "Pacific/Tahiti", "OC"],
  ["Nukuʻalofa", "TO", -21.1393, -175.2049, "Pacific/Tongatapu", "OC"],
];

/** Every city, in one list. */
export const CITIES = [...CITY_ROWS, ...CITY_ROWS_MORE];

/** City slug -> row, built once. */
function expand(row, index) {
  const [city, countryCode, lat, lon, zone, region] = row;
  return { id: cityId(city, countryCode), city, countryCode, lat, lon, zone, region, order: index, kind: "city" };
}

/**
 * Stable, human-readable id for a city: `delhi-in`, `sao-paulo-br`.
 * Diacritics are stripped so the id survives being typed in a URL.
 */
export function cityId(city, countryCode) {
  const base = String(city)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\u02b0-\u02ff\u2018\u2019]/g, "")   // glottal + curly apostrophes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${String(countryCode || "").toLowerCase()}`;
}

export const CITY_BY_ID = new Map(CITIES.map((row, index) => [expand(row, index).id, expand(row, index)]));

/** All cities as objects. */
export function allCities() {
  return [...CITY_BY_ID.values()];
}

export function findCity(id) {
  return CITY_BY_ID.get(String(id)) || null;
}

/* -------------------------------------------------------- geospatial lookup */

const toRad = (value) => (Number(value) * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The city closest to a coordinate pair — used to name a GPS fix
 * ("near Ahmedabad") without asking a reverse-geocoding service.
 */
export function nearestCity(lat, lon, options = {}) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  let best = null;
  for (const city of allCities()) {
    const km = distanceKm(Number(lat), Number(lon), city.lat, city.lon);
    if (!best || km < best.distanceKm) best = { ...city, distanceKm: km };
  }
  if (!best) return null;
  const limit = Number.isFinite(options.maxKm) ? options.maxKm : null;
  if (limit !== null && best.distanceKm > limit) return null;
  return best;
}

/** Cities in one region, alphabetical. */
export function citiesInRegion(region) {
  return allCities().filter((city) => city.region === region);
}

/** Cities in one country (ISO code), alphabetical. */
export function citiesInCountry(code) {
  const wanted = String(code || "").toUpperCase();
  return allCities().filter((city) => city.countryCode.toUpperCase() === wanted);
}
