import re
import json

data = """MUTANT | Mutant - MIND FK - Tropical Punch 460g | $565.50 | $507.00 | $448.50
MUTANT | Mutant Caffeine (Core Series) 240 tablets | $203.00 | $182.00 | $161.00
MUTANT | Mutant Mass - Triple Chocolate Flavor - 15 lbs/6.8kg | $1,419.55 | $1,272.70 | $1,125.85
MUTANT | Mutant Mass - Vanilla Ice Cream Flavor - 15 lbs/6.8kg | $1,419.55 | $1,272.70 | $1,125.85
MUTANT | Mutant Whey - Triple Chocolate 5lb/2.27kg | $983.10 | $881.40 | $779.70
MUTANT | Mutant Whey - Vanilla Ice Cream 5lb/2.27kg | $983.10 | $881.40 | $779.70
NUTRAKEY | L- Carnitine 3000 - Passion Berry | $413.25 | $370.50 | $327.75
NUTREX | 100% WHEY CHOCOLATE - 10lbs | $1,713.90 | $1,536.60 | $1,359.30
NUTREX | 100% WHEY CHOCOLATE 5lb | $1,168.70 | $1,047.80 | $926.90
NUTREX | 100% WHEY COOKIES & CREAM 5LB | $1,168.70 | $1,047.80 | $926.90
NUTREX | 100% WHEY VAINILLA 5lb | $1,168.70 | $1,047.80 | $926.90
NUTREX | 100% WHEY VANILLA - 10lbs | $1,713.90 | $1,536.60 | $1,359.30
NUTREX | CLA 1000 - 90 Capsules - 12CS | $261.00 | $234.00 | $207.00
NUTREX | CREATINA NUTREX | $246.50 | $221.00 | $195.50
NUTREX | CREATINA NUTREX 1KG | $587.25 | $526.50 | $465.75
NUTREX | OUTLIFT AMPED SUCKER PUNCH - 22s - 6CS | $609.00 | $546.00 | $483.00
NUTREX | Outlift Clinical - Frost Bite - 22srv (6/cs) | $619.15 | $555.10 | $491.05
NUTREX | Outlift Clinical - Fruit Punch - 22srv (6/cs) | $619.15 | $555.10 | $491.05
NUTREX | Outlift Clinical - Miami Vice - 22srv (6/cs) | $619.15 | $555.10 | $491.05
NUTREX | Outrage Fruit Punch - 30srv | $326.25 | $292.50 | $258.75
NUTREX | Outrage Lemon Lime - 30srv | $326.25 | $292.50 | $258.75
NUTREX | Outrage Strawberry Watermelon - 30srv | $326.25 | $292.50 | $258.75
RAW | Creatine 250g - 50s | $478.50 | $429.00 | $379.50
RAW | Creatine 500g - 100s | $572.75 | $513.50 | $454.25
RAW | Creatine Stick Pack Box 30sv | $435.00 | $390.00 | $345.00
RAW | Essential Champion Mentality | $478.50 | $429.00 | $379.50
RAW | ESSENTIAL CHARGED BLUE | $498.80 | $447.20 | $395.60
RAW | ESSENTIAL CHARGED WATERMELON | $498.80 | $447.20 | $395.60
RAW | ESSENTIAL CITRUS | $478.50 | $429.00 | $379.50
RAW | Essential Fruit Burst | $478.50 | $429.00 | $379.50
RAW | Essential Grape | $478.50 | $429.00 | $379.50
RAW | Essential Grape Watermelon | $478.50 | $429.00 | $379.50
RAW | Essential Icy Lemon Slush | $478.50 | $429.00 | $379.50
RAW | ESSENTIAL Jamaica | $478.50 | $429.00 | $379.50
RAW | ESSENTIAL ORANGE | $478.50 | $429.00 | $379.50
RAW | Essential Rasberry Creamthickle | $478.50 | $429.00 | $379.50
RAW | Essential Red , White and Bum | $478.50 | $429.00 | $379.50
RAW | ESSENTIAL Tamarindo | $478.50 | $429.00 | $379.50
RAW | ESSENTIAL WATERMELON | $478.50 | $429.00 | $379.50
RAW | ESSENTIAL WATERMELON 60 SERVICIOS | $681.50 | $611.00 | $540.50
RAW | Essentials performance citrus grapefruit - 25s | $558.25 | $500.50 | $442.75
RAW | ITHOLATE CHOCOLATE 5 LBS | $2,044.50 | $1,833.00 | $1,621.50
RAW | ITHOLATE CINNAMON CRUNCH 5 LBS | $2,044.50 | $1,833.00 | $1,621.50
RAW | Itholate Protein - Grandma Apple - 2lb | $1,015.00 | $910.00 | $805.00
RAW | Itholate Protein - Maple Waffle - 5lb | $2,044.50 | $1,833.00 | $1,621.50
RAW | ITHOLATE VAINILLA 5 LBS | $2,044.50 | $1,833.00 | $1,621.50
RAW | ITHOLATE VAINILLA OATMEL | $2,044.50 | $1,833.00 | $1,621.50
RAW | PREMIUM WHEY CBUM - Vanilla - 5lb - 67s | $1,653.00 | $1,482.00 | $1,311.00
RAW | Protein RTD - Salted Caramel - 12oz - (12/CS) | $1,029.50 | $923.00 | $816.50
RAW | Protein RTD - Strawberry Milkshake 12oz (12/CS) | $1,029.50 | $923.00 | $816.50
RAW | Protein RTD - Vanilla Milkshake - 12oz (12/CS) | $1,029.50 | $923.00 | $816.50
RAW | PUMP - NON STIM - Watermelon Grape | $565.50 | $507.00 | $448.50
RAW | PUMP NON-STIM - Lemonade - 40s | $565.50 | $507.00 | $448.50
RAW | RAW - FUEL Lemon Lime - 60s | $652.50 | $585.00 | $517.50
RAW | RAW - FUEL Orange - 60s | $652.50 | $585.00 | $517.50
RAW | RAW - FUEL Strawberry Kiwi - 60s | $652.50 | $585.00 | $517.50
RAW | THAVAGE Pre Jamaica | $681.50 | $611.00 | $540.50
RAW | THAVAGE Pre Tamarindo | $681.50 | $611.00 | $540.50
RAW | Thavage Pre Workout Lemon Lime - 40s | $681.50 | $611.00 | $540.50
RAW | THAVAGE Pre Workout Lemonade - | $681.50 | $611.00 | $540.50
RAW | Thavage Pre Workout Peach Bum - 40/20s | $681.50 | $611.00 | $540.50
RAW | Thavage Pre Workout Sour Watermelon - | $681.50 | $611.00 | $540.50
RAW | Thuper Thavage - 6 PEAT | $899.00 | $806.00 | $713.00
RAW | THUPER THAVAGE - Jamaica | $899.00 | $806.00 | $713.00
RAW | THUPER THAVAGE - Tamarindo | $899.00 | $806.00 | $713.00
RAW | THUPER THAVAGE CHERRY | $899.00 | $806.00 | $713.00
PVL | DOMIN8 ORANGE KRUSH'D 520g | $449.50 | $403.00 | $356.50
PVL | ISOGOLD SPORT Ice Cream Cookie Sandwich Flavour 2.27 kg (5lbs) | $1,653.00 | $1,482.00 | $1,311.00
PVL | PVL - EAA+BCAA COMPLETE Icy Blue Storm | $377.00 | $338.00 | $299.00
PVL | PVL - EAA+BCAA COMPLETE Icy Blue Storm 7 SV | $94.25 | $84.50 | $74.75
PVL | PVL Statement Series Shaker Cup 1L NAVY BLUE | $174.00 | $156.00 | $138.00
RAW | BETA ALANINA RAW | $536.50 | $481.00 | $425.50
RAW | BITE SIZE PROTEIN MILK AND COOKIE | $116.00 | $104.00 | $92.00
RAW | CBUM Energy Champion Mentality - 12oz | $652.50 | $585.00 | $517.50
RAW | CBUM Energy Cherry Frost - 12oz (12can/Tray) | $652.50 | $585.00 | $517.50
RAW | CBUM Energy Cola - 12oz (12can/Tray) | $652.50 | $585.00 | $517.50
RAW | CBUM Energy DR BUM - 12oz (12can/Tray) | $652.50 | $585.00 | $517.50
RAW | CBUM Energy GRAPE - 12oz (12can/Tray) | $652.50 | $585.00 | $517.50
RAW | CBUM Energy Peach Mango - 12oz (12can/Tray) | $652.50 | $585.00 | $517.50
RAW | CBUM Energy Pink Lemonade - 12oz | $652.50 | $585.00 | $517.50
RAW | CBUM Energy Root Beer - 12oz (12can/Tray) | $652.50 | $585.00 | $517.50
RAW | CBUM Energy Strawberry Lemonade - 12oz | $652.50 | $585.00 | $517.50
RAW | CBUM Itholate - 5lb - Churro | $2,044.50 | $1,833.00 | $1,621.50
RAW | CBUM Itholate Protein - Mocha Latte - 2lb - 25s | $1,015.00 | $910.00 | $805.00
RAW | CBUM PREMIUM WHEY - Chocolate - 5lb | $1,653.00 | $1,482.00 | $1,311.00
RAW | CBUM Thavage 6 Peat Pre Workout | $681.50 | $611.00 | $540.50
RAW | CREATINA 30 SV | $413.25 | $370.50 | $327.75
PROSUPPS | Dr. Jekyll Signature (30srv) - Orange | $551.00 | $494.00 | $437.00
PROSUPPS | Dr. Jekyll Signature (30srv) - Strawberry | $551.00 | $494.00 | $437.00
PROSUPPS | Dr. Jekyll Signature (30srv) Blueberry Lemonade | $551.00 | $494.00 | $437.00
PSYCHOPHARMA | CREATINA 500G PSYCHO PHARMA | $638.00 | $572.00 | $506.00
PSYCHO PHARMA | EDGE BLUE LEMONADE 305G | $594.50 | $533.00 | $471.50
PSYCHOPHARMA | EDGE JUNGLE JUICE 300G | $594.50 | $533.00 | $471.50
PSYCHOPHARMA | Edge of Insanity BlueCotteon Candy | $594.50 | $533.00 | $471.50
PSYCHO PHARMA | Edge of Insanity PinkDragon Fruite | $594.50 | $533.00 | $471.50
PSYCHOPHARMA | EDGE PIÑA COLADA | $594.50 | $533.00 | $471.50
PSYCHOPHARMA | EDGE SPIKED PUNCH | $594.50 | $533.00 | $471.50
PSYCHOPHARMA | EDGE STRAWBERRY WATERMELON POP 355G | $594.50 | $533.00 | $471.50
PSYCHOPHARMA | FAR BEYOND DRIVEN | $493.00 | $442.00 | $391.00
PSYCHOPHARMA | Psycho Syrup Purple Drank | $652.50 | $585.00 | $517.50
PSYCHOPHARMA | Psycho Syrup Unflavored | $652.50 | $585.00 | $517.50
PSYCHOPHARMA | SOBRES PSYCHO PHARMA | $29.00 | $26.00 | $23.00
PUMP SAUCE | PUMP SAUCE - Hot Sauce - Gummy Shark | $797.50 | $715.00 | $632.50
PUMP SAUCE | PUMP SAUCE - Panda Collab Strawberry | $826.50 | $741.00 | $655.50
PUMP SAUCE | PUMP SAUCE - White Cherry Slushy - 32 Fl Oz 16/32 Serv pings | $638.00 | $572.00 | $506.00
PUMP SAUCE | Pump Sauce 1s Shot 12pk Tropical PumpSicle | $536.50 | $481.00 | $425.50
PUMP SAUCE | PUMP SAUCE GUMMY SHARKS | $638.00 | $572.00 | $506.00
PUMP SAUCE | PUMP SAUCE GUMMY WORMS | $638.00 | $572.00 | $506.00
PUMP SAUCE | Pump Sauce Lean LCarnitine 31s Passion Berry | $420.50 | $377.00 | $333.50
PUMP SAUCE | Pump Sauce Lean LCarnitine 31s Shark Gummy | $420.50 | $377.00 | $333.50
PUMP SAUCE | PUMP SAUCE PEACH | $638.00 | $572.00 | $506.00
PUMP SAUCE | PUMP SAUCE STRAWBERRY | $638.00 | $572.00 | $506.00
PUMP SAUCE | PUMP SAUCE WATERMELON | $638.00 | $572.00 | $506.00
PUMP SAUCE | Shooters Display - 12Pk - Sour Gummy Worms | $536.50 | $481.00 | $425.50
PUMP SAUCE | Shooters Display - 12Pk Shots Watermelon Margarita | $536.50 | $481.00 | $425.50
PVL | Clean Mass XL 1 SV | $50.75 | $45.50 | $40.25
PVL | Clean Mass XL Triple Chocolate Cake 10LBS | $1,087.50 | $975.00 | $862.50
PVL | Clean Mass XL Vanilla Ice Cream 10LBS | $1,087.50 | $975.00 | $862.50"""

def get_category(name):
    n = name.lower()
    if any(x in n for x in ['whey', 'mass', 'protein', 'itholate', 'domin8', 'isogold']): return 'Proteína'
    if any(x in n for x in ['creatin', 'creapure']): return 'Creatina'
    if any(x in n for x in ['pre workout', 'pre-workout', 'thavage', 'insanity', 'energy', 'pump', 'edge', 'jekyll', 'outrage', 'outlift', 'cbum energy']): return 'Pre-Entreno'
    if any(x in n for x in ['carnitine', 'cla', 'burn', 'driven']): return 'Quemador'
    if any(x in n for x in ['amino', 'bcaa', 'eaa']): return 'Aminos'
    return 'Variedad'

lines = data.split('\n')
out = ""
start = 127
for line in lines:
    if not line.strip(): continue
    parts = line.split(' | ')
    if len(parts) == 5:
        brand = parts[0].strip()
        name = parts[1].strip()
        p1 = float(re.sub(r'[$,]', '', parts[2].strip()))
        p2 = float(re.sub(r'[$,]', '', parts[3].strip()))
        p3 = float(re.sub(r'[$,]', '', parts[4].strip()))
        cat = get_category(name)
        
        out += f'  {{ id: {start}, brand: "{brand}", name: "{name}", category: "{cat}", price1: {p1}, price2: {p2}, price3: {p3} }},\n'
        start += 1

with open(r'c:\Users\LAP\Downloads\front-end-Thaiger-Supplements-main\front-end-Thaiger-Supplements-main\src\data\new_products.txt', 'w', encoding='utf-8') as f:
    f.write(out)
