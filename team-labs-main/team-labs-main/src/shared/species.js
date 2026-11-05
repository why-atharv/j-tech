export const RARITY = {
  common: { label: 'Common', points: 10, weight: 0.62, ttl: [60, 80], color: '#7cffb2' },
  rare: { label: 'Rare', points: 25, weight: 0.3, ttl: [50, 65], color: '#5ac8ff' },
  legendary: { label: 'Legendary', points: 50, weight: 0.08, ttl: [40, 50], color: '#ffb547' },
  mythic: { label: 'Mythic', points: 100, weight: 0, ttl: [32, 40], color: '#c77dff' }
};

const LAND = 'ground';
const AIR = 'air';

const ROSTER = [
  ['vulpix', 'Vulpix', 37, 'common', LAND, '🦊', '#ff7a3d', 'fire', 'Ember', 'ember', 'Muh se chhoti fire sparks nikalta hai', 'Halki aur furtiili trot, 6 tails lehrate hue'],
  ['ponyta', 'Ponyta', 77, 'common', LAND, '🐴', '#ffb03a', 'fire', 'Flame Wheel', 'flamewheel', 'Daudte waqt aag ka ghera banata hai', 'Graceful canter, fire-mane peeche lehrati hai'],
  ['eevee', 'Eevee', 133, 'common', LAND, '🐾', '#c98a4a', 'normal', 'Quick Attack', 'quick', 'White trail chhodte hue dash karta hai', 'Playful bounding hops, ruk kar kaan hilata hai'],
  ['doduo', 'Doduo', 84, 'common', LAND, '🐦', '#c08a52', 'flying', 'Fury Attack', 'peck', 'Dono siron se tezi se chonch maarta hai', 'High-speed zig-zag sprint'],
  ['electabuzz', 'Electabuzz', 125, 'common', LAND, '⚡', '#ffd23a', 'electric', 'Thunder Shock', 'shock', 'Body ke aas-paas electric sparks', 'Heavy crouch-walk, haath ghumata hai'],
  ['mankey', 'Mankey', 56, 'common', LAND, '🐒', '#e9d8bf', 'fighting', 'Karate Chop', 'chop', 'Hawa mein uchhal kar haath maarta hai', 'Hyperactive side-to-side swagger'],
  ['sandshrew', 'Sandshrew', 27, 'common', LAND, '🦔', '#e8c36a', 'ground', 'Defense Curl', 'curl', 'Ekdum gol gend bankar roll hota hai', 'Low scurrying walk, ball bankar roll'],
  ['pikachu', 'Pikachu', 25, 'common', LAND, '⚡', '#ffe03a', 'electric', 'Thunderbolt', 'thunderbolt', 'Gaalon se peeli bijli ki wave', 'Scamper karke ruk kar Pika-Pika wave'],
  ['rhyhorn', 'Rhyhorn', 111, 'common', LAND, '🦏', '#a7adb4', 'rock', 'Horn Attack', 'horn', 'Seeng neeche karke seedha charge', 'Heavy bulldozing charge, dust effect'],
  ['slowpoke', 'Slowpoke', 79, 'common', LAND, '🦛', '#ff9fb8', 'water', 'Water Gun', 'watergun', 'Dheere se muh se paani ka fawara', 'Ultra-slow sleepy waddle'],
  ['pidgeotto', 'Pidgeotto', 17, 'common', AIR, '🐦', '#d79a52', 'flying', 'Gust', 'gust', 'Pankh fadfada kar hawa ka bawandar', 'Smooth gliding swoop aur dive'],
  ['spearow', 'Spearow', 21, 'common', AIR, '🐤', '#d8553a', 'flying', 'Peck', 'peckfast', 'Tez raftaar mein chonch maarta hai', 'Rapid erratic darting flight'],
  ['farfetchd', "Farfetch'd", 83, 'common', LAND, '🦆', '#b98a5a', 'flying', 'Slash', 'slash', 'Green leek stick talwar jaise ghumata hai', 'Proud marching waddle'],
  ['butterfree', 'Butterfree', 12, 'common', AIR, '🦋', '#9aa7ff', 'bug', 'Silver Wind', 'silverwind', 'Pankhon se chamakdar powder', 'Gentle fluttering hover'],
  ['ninetales', 'Ninetales', 38, 'rare', LAND, '🦊', '#ffe39a', 'fire', 'Will-O-Wisp', 'wisp', 'Neeli mystical fire balls hawa mein', 'Regal silent floating stride'],
  ['rapidash', 'Rapidash', 78, 'rare', LAND, '🦄', '#ffc76a', 'fire', 'Fire Spin', 'firespin', 'Daudte hue aag ka bhanwar', 'Super-fast bullet gallop'],
  ['growlithe', 'Growlithe', 58, 'rare', LAND, '🐕', '#ff9a4a', 'fire', 'Flame Burst', 'flameburst', 'Bhaukte hue aag ka gola', 'Loyal alert prowl, poonch hilata hai'],
  ['scyther', 'Scyther', 123, 'rare', LAND, '🦗', '#8fd65a', 'bug', 'X-Scissor', 'xscissor', 'Blades cross karke green slash', 'Ninja ultra-fast low dash'],
  ['kangaskhan', 'Kangaskhan', 115, 'rare', LAND, '🦘', '#b08a62', 'normal', 'Mega Punch', 'megapunch', 'Chakkar ghumakar zordaar mukka', 'Heavy bipedal stomp'],
  ['slowbro', 'Slowbro', 80, 'rare', LAND, '🐚', '#ffa6c0', 'water', 'Water Pulse', 'waterpulse', 'Gol paani ki waves charon taraf', 'Swaying upright lumber'],
  ['rhydon', 'Rhydon', 112, 'rare', LAND, '🦏', '#b9b3a8', 'rock', 'Horn Drill', 'horndrill', 'Horn drill machine jaise ghumata hai', 'Earth-shaking bipedal march'],
  ['exeggutor', 'Exeggutor', 103, 'rare', LAND, '🌴', '#f4d35a', 'grass', 'Egg Bomb', 'eggbomb', 'Chamakte energy seeds girata hai', 'Tall swaying tree stomp'],
  ['nidoking', 'Nidoking', 34, 'rare', LAND, '👑', '#b07ad8', 'poison', 'Earthquake', 'earthquake', 'Pair patak kar shockwave', 'Wide-stanced aggressive stomp'],
  ['tauros', 'Tauros', 128, 'rare', LAND, '🐂', '#c98d55', 'normal', 'Take Down', 'takedown', '3 poonch whip karke full speed takkar', 'Unstoppable bull charge'],
  ['nidoqueen', 'Nidoqueen', 31, 'rare', LAND, '💙', '#6f9fd0', 'poison', 'Superpower', 'superpower', 'Neeli aura ke saath ground punch', 'Sturdy armored stride'],
  ['flareon', 'Flareon', 136, 'rare', LAND, '🔥', '#ff7a3a', 'fire', 'Lava Plume', 'lavaplume', 'Collar se laal-narangi aag ki lehar', 'Fluffy prancing gait'],
  ['snorlax', 'Snorlax', 143, 'rare', LAND, '😴', '#4f8796', 'normal', 'Body Slam', 'bodyslam', 'Kood kar pet ke bal dhamaka', 'Slow belly-jiggling waddle, phir Zzz'],
  ['persian', 'Persian', 53, 'rare', LAND, '🐈', '#f4e6c4', 'normal', 'Power Gem', 'powergem', 'Maathe ke gem se light beam', 'Silent fluid feline stalk'],
  ['jolteon', 'Jolteon', 135, 'rare', LAND, '⚡', '#ffe14a', 'electric', 'Discharge', 'discharge', 'Spiky fur se electric bolts', 'Lightning-fast sprint aur stop'],
  ['raichu', 'Raichu', 26, 'rare', LAND, '⚡', '#f2a23a', 'electric', 'Volt Tackle', 'volttackle', 'Body ko bijli mein lapet kar jump', 'Energetic bounding leaps'],
  ['golbat', 'Golbat', 42, 'rare', AIR, '🦇', '#6a9ae0', 'poison', 'Air Cutter', 'aircutter', 'Pankhon se hawa ke blades', 'Silent swooping figure-8 flight'],
  ['lapras', 'Lapras', 131, 'rare', LAND, '🐢', '#5fb0f0', 'water', 'Ice Beam', 'icebeam', 'Barf ki chamakdar zig-zag beam', 'Graceful floating slide'],
  ['dodrio', 'Dodrio', 85, 'rare', LAND, '🐦', '#b07a4a', 'flying', 'Tri Attack', 'triattack', 'Teeno siron se Fire, Ice, Electric beam', 'High-jump running stride'],
  ['fearow', 'Fearow', 22, 'rare', AIR, '🦅', '#d08a4a', 'flying', 'Drill Peck', 'drillpeck', 'Chonch ghumate hue sky-dive', 'Wide-wingspan thermal gliding'],
  ['aerodactyl', 'Aerodactyl', 142, 'rare', AIR, '🦖', '#b6a6cc', 'rock', 'Ancient Power', 'ancientpower', 'Chamakte pathar utha kar phenkna', 'Fierce prehistoric swoop'],
  ['arcanine', 'Arcanine', 59, 'legendary', LAND, '🦁', '#ff9a3a', 'fire', 'Extreme Speed', 'extremespeed', 'Aag ki roshni ke saath hawa se tez dash', 'Majestic lion-like bounding stride'],
  ['charizard', 'Charizard', 6, 'legendary', LAND, '🐉', '#ff8a2a', 'fire', 'Fire Blast', 'fireblast', 'Aasman mein vishal aag ka Dai blast', 'Dragon walk phir low-altitude flight'],
  ['mew', 'Mew', 151, 'legendary', LAND, '💗', '#ff9ccf', 'psychic', 'Psychic', 'psychic', 'Pink glowing energy bubble pulse', 'Playful zero-gravity somersaults'],
  ['articuno', 'Articuno', 144, 'legendary', AIR, '❄️', '#8fd8ff', 'ice', 'Blizzard', 'blizzard', 'Dome mein barf ka toofan', 'Royal slow-motion flight'],
  ['blastoise', 'Blastoise', 9, 'legendary', LAND, '🐢', '#5a9ae8', 'water', 'Hydro Pump', 'hydropump', 'Dono cannons se high-pressure paani', 'Heavy armored tank march'],
  ['machamp', 'Machamp', 68, 'legendary', LAND, '💪', '#9ab0c8', 'fighting', 'Dynamic Punch', 'dynamicpunch', 'Charon haathon se rapid shockwave punches', 'Confident powerhouse strut'],
  ['zapdos', 'Zapdos', 145, 'legendary', AIR, '⚡', '#ffe02a', 'electric', 'Thunder', 'thunder', 'Aasman se seedha bijli girana', 'Sharp electric zig-zag flight'],
  ['moltres', 'Moltres', 146, 'legendary', AIR, '🔥', '#ffb02a', 'fire', 'Sky Attack', 'skyattack', 'Vishal phoenix golden aag', 'Graceful fiery phoenix dance']
];

export const SPECIES = ROSTER.map(([key, name, dex, rarity, kind, emoji, accent, type, move, fx, moveText, walk]) => ({ key, name, dex, rarity, kind, emoji, accent, type, move, fx, moveText, walk, model: key }));

SPECIES.push({
  key: 'mewtwo',
  name: 'Mewtwo',
  dex: 150,
  rarity: 'mythic',
  model: 'mewtwo',
  kind: LAND,
  emoji: '🔮',
  accent: '#c77dff',
  glow: '#b45cff',
  type: 'psychic',
  move: 'Psystrike',
  fx: 'psystrike',
  moveText: 'Dark-purple psychic sphere aur glowing rings',
  walk: 'Telekinetic levitation aur instant teleport',
  prize: true
});

export const SPECIES_BY_KEY = Object.fromEntries(SPECIES.map((s) => [s.key, s]));

export const PRIZE_KEY = 'mewtwo';

export function pickSpecies(forceRarity, random = Math.random) {
  let rarity = forceRarity;
  if (!rarity) {
    const roll = random();
    rarity = roll < RARITY.legendary.weight ? 'legendary' : roll < RARITY.legendary.weight + RARITY.rare.weight ? 'rare' : 'common';
  }
  const pool = SPECIES.filter((s) => s.rarity === rarity && !s.prize);
  return pool[Math.floor(random() * pool.length)];
}
