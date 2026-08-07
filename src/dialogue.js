// ============================================================
// GRIND & GRIMOIRE — full script.
// Pure data: imported by the game (subtitles) AND by
// tools/generate-audio.mjs (ElevenLabs TTS generation).
// ============================================================

export const VOICES = {
  kai:      'bIHbv24MWmeRgasZH58o', // Will — relaxed optimist (the wizard)
  narrator: 'JBFqnCBsd6RMkjVDRZzb', // George — warm storyteller
  mira:     'cgSgspJ2msm6clMCkdW9', // Jessica — barista
  gus:      'pqHfZKP75CvOlQylNhV4', // Bill — vape shop elder
  noa:      'XrExE9yKIg1WjnnlVkGX', // Matilda — poke shop
  priya:    'EXAVITQu4vr4xnSDxMaL', // Sarah — ice cream
  sage:     'cjVigY5qzO86Huf0OWal', // Eric — kombucha
  rex:      'CwhRBWXzGAHq8TQ4Fs17', // Roger — clothing shops
  dev:      'iP95p4xoKVk53GoZ742B', // Chris — friend
  juno:     'FGY2WhTYpPnrIDTdsKH5', // Laura — friend
  tyler:    'TX3LPaxmHKxFdv7VOQHJ', // Liam — friend / party host
  fan1:     'IKne3meq5aSn9XLyUdCD', // Charlie — hyped stranger
  fan2:     '6ujHuaecAbCVnI2iof7L', // Tamara — upbeat stranger
  fan3:     'SAz9YHcvj6GT2YYXdXww', // River — deadpan stranger
  fiend:    'N2lVS1w4EtoT3dr4eOWO', // Callum — husky (the crackheads)
  dj:       'pNInz6obpgDQGcFmaJgB', // Adam — the mixtape hustler
};

// speaker: display name. v: voice key. text: subtitle + TTS input.
export const LINES = {
  // ---- Intro cutscene ----
  n_intro_1:  { v: 'narrator', speaker: 'NARRATOR', text: 'Venice Beach, California. Two in the afternoon. The ocean hums, the palms gossip, and the pavement waits.' },
  n_intro_2:  { v: 'narrator', speaker: 'NARRATOR', text: 'Tonight at two a.m., in a backyard off Rose Avenue, there is an open mic. Our hero intends to speak.' },
  n_intro_3:  { v: 'narrator', speaker: 'NARRATOR', text: 'He has fireballs. He has a skateboard. What he does not have... is a poem.' },
  k_intro_1:  { v: 'kai', speaker: 'KAI', text: 'Fireballs are easy. Poetry is terrifying. Alright, Venice. Give me some inspiration.' },

  // ---- Coffee shop: LALA'S LATTE ----
  m_coffee_1: { v: 'mira', speaker: 'MIRA', text: "Welcome to Lala's Latte. What can I get you?" },
  k_coffee_1: { v: 'kai', speaker: 'KAI', text: 'One ube latte, one spam musubi, and, uh... are you into wizards?' },
  m_coffee_2: { v: 'mira', speaker: 'MIRA', text: "I have a boyfriend. He's also a wizard. Taller, though." },
  k_coffee_2: { v: 'kai', speaker: 'KAI', text: 'Cool. Cool cool cool. Table for one, then.' },
  k_coffee_3: { v: 'kai', speaker: 'KAI', text: "Okay, honestly? This latte slaps. Alone at a tiny table with a warm musubi. That's basically a poem." },

  // ---- Vape shop: CLOUD TEMPLE ----
  g_vape_1:   { v: 'gus', speaker: 'GUS', text: "Cloud Temple, what's good. New flavor just dropped: Mango Tsunami. It's basically a health product." },
  k_vape_1:   { v: 'kai', speaker: 'KAI', text: "One hit. For research. ... Kuh— KHH— Gus. Gus, I'm dying. Gus... I can see through time." },
  g_vape_2:   { v: 'gus', speaker: 'GUS', text: "That's the Tsunami, baby. You want the large?" },
  k_vape_2:   { v: 'kai', speaker: 'KAI', text: '...Yeah, okay.' },

  // ---- Poke shop: POKE PARADISE ----
  o_poke_1:   { v: 'noa', speaker: 'NOA', text: 'Poke Paradise. Easy on the wasabi, honey, it is fresh today.' },
  k_poke_1:   { v: 'kai', speaker: 'KAI', text: "Relax. I'm a wizard. I know my way around a green paste." },
  k_poke_2:   { v: 'kai', speaker: 'KAI', text: 'WHY. Why is there FIRE in my SKULL. My third eye is weeping.' },
  o_poke_2:   { v: 'noa', speaker: 'NOA', text: 'Every. Single. Time. With you people.' },

  // ---- Ice cream: SCOOP DREAMS ----
  p_ice_1:    { v: 'priya', speaker: 'PRIYA', text: 'One basil lime for the gentleman. Handle it with respect.' },
  k_ice_1:    { v: 'kai', speaker: 'KAI', text: 'Basil. Lime. This is what the ancients meant by alchemy.' },
  k_ice_2:    { v: 'kai', speaker: 'KAI', text: 'NO. No no no NO. It touched the GROUND. Ten seconds. I had it for TEN SECONDS. Why is life like this.' },

  // ---- Kombucha: THE BOOCH BARN ----
  s_kom_1:    { v: 'sage', speaker: 'SAGE', text: 'Welcome to the Booch Barn. This batch has notes of ginger, chaos, and destiny.' },
  k_kom_1:    { v: 'kai', speaker: 'KAI', text: 'Tastes like a lightning storm did yoga. Hey... whose dog is this? He is staring directly into my soul.' },
  s_kom_2:    { v: 'sage', speaker: 'SAGE', text: 'That is Kickflip. He chooses one person per decade. Congratulations, man.' },
  k_kom_2:    { v: 'kai', speaker: 'KAI', text: "Kickflip... let's go get inspired, buddy." },

  // ---- Clothing shops ----
  r_drip_1:   { v: 'rex', speaker: 'REX', text: 'Ohh, you have got the eye. Put that on and strangers will weep in the street.' },
  k_drip_1:   { v: 'kai', speaker: 'KAI', text: "Don't wrap it. I'm wearing it out." },

  // ---- Stranger compliments (one unique line per drip piece) ----
  st_1:       { v: 'fan1', speaker: 'STRANGER', text: 'YO! The drip is CRAZY! Wizard drip!' },
  st_2:       { v: 'fan2', speaker: 'STRANGER', text: 'Oh my god, the fit. THE FIT!' },
  st_3:       { v: 'fan3', speaker: 'STRANGER', text: 'Honestly? Iconic. You look iconic right now.' },
  st_4:       { v: 'fan2', speaker: 'STRANGER', text: 'EXCUSE ME. The shades?? Where did you GET those??' },
  st_5:       { v: 'fan1', speaker: 'STRANGER', text: 'Bro is GLOWING. The kicks are literally glowing, bro!' },
  st_6:       { v: 'fan3', speaker: 'STRANGER', text: 'Is that... a halo? Okay. Angel behavior. Angel behavior.' },
  // ---- Kai does NOT want the ego ----
  k_comp_1:   { v: 'kai', speaker: 'KAI', text: 'Please stop. My ego is at capacity. I am serious.' },
  k_comp_2:   { v: 'kai', speaker: 'KAI', text: 'No, no, don’t perceive me. I can feel the power going straight to my head.' },
  k_comp_3:   { v: 'kai', speaker: 'KAI', text: 'Thank you, but also, never say that again. I am becoming insufferable.' },

  // ---- DJ Crates, the mixtape guy ----
  mx_1:       { v: 'dj', speaker: 'DJ CRATES', text: 'Yo yo yo, hold up, hold up — you look like a man of taste. I got my mixtape right here. Fifteen bucks. It will change your life.' },
  k_mx_1:     { v: 'kai', speaker: 'KAI', text: 'I’m kind of on a sacred quest right n—' },
  mx_2:       { v: 'dj', speaker: 'DJ CRATES', text: 'It’s called Ocean Front Heat, Volume Nine. There is no volume one through eight. Fifteen bucks.' },
  k_mx_2:     { v: 'kai', speaker: 'KAI', text: '...Fine. This better slap.' },
  mx_3:       { v: 'dj', speaker: 'DJ CRATES', text: 'No refunds! Enjoy the journey, king!' },
  k_mx_3:     { v: 'kai', speaker: 'KAI', text: 'This is the worst thing I have ever heard... and I cannot stop listening to it.' },
  mx_4:       { v: 'dj', speaker: 'DJ CRATES', text: 'No refunds. The journey is one-way, king.' },

  // ---- the reckless driver ----
  kar_1:      { v: 'fan2', speaker: 'DRIVER', text: 'Oh my GOD, watch where you’re skating?? I am literally driving here??' },
  kar_2:      { v: 'fan2', speaker: 'DRIVER', text: 'Um, you can NOT just exist in the road?? So dangerous??' },
  kar_3:      { v: 'fan2', speaker: 'DRIVER', text: 'You hit my CAR!! You are paying my deductible, wizard!!' },
  kar_4:      { v: 'fan2', speaker: 'DRIVER', text: 'UGH, whatever?? I have pilates?? Learn to skate on the SIDEWALK??' },

  // ---- rooftop party side quest ----
  rp_1:       { v: 'fan3', speaker: 'PROMOTER', text: 'Yo. You seem like you appreciate altitude. Secret rooftop thing tonight — tallest building downtown. Meet me at the base.' },
  k_rp_1:     { v: 'kai', speaker: 'KAI', text: 'A rooftop party. That’s like a regular party, but closer to the moon. Say less.' },
  rp_2:       { v: 'fan3', speaker: 'PROMOTER', text: 'You made it. Elevator’s broken, obviously. Good thing I know a guy. Hold on to your hat.' },
  rp_3:       { v: 'fan3', speaker: 'PROMOTER', text: 'Welcome to the top of the world, man. Well. The top of Santa Monica. Same thing.' },
  k_rp_2:     { v: 'kai', speaker: 'KAI', text: 'Okay, wow. This view is extremely inspiring. Wait. No. I can feel it inflating my ego. DANG it.' },

  // ---- Friends ----
  f_dev_1:    { v: 'dev', speaker: 'DEV', text: 'Kai! There he is! You ready to spit that poetry tonight or what?' },
  k_fdev_1:   { v: 'kai', speaker: 'KAI', text: 'It is marinating, Dev. The poem is marinating.' },
  f_juno_1:   { v: 'juno', speaker: 'JUNO', text: 'Two a.m. Rose Avenue. Open mic. Do NOT show up with mid bars. You ready?' },
  k_fjuno_1:  { v: 'kai', speaker: 'KAI', text: 'Juno. I will be ready. I just need, like... several more epiphanies.' },
  f_tyler_1:  { v: 'tyler', speaker: 'TYLER', text: "Yooo, Kai! Party's gonna be nuts tonight. Your poem done or nah?" },
  k_ftyler_1: { v: 'kai', speaker: 'KAI', text: 'It is in pre-production, Tyler.' },

  // ---- Gameplay barks ----
  k_fire_1:   { v: 'kai', speaker: 'KAI', text: 'Ignis!' },
  k_fire_2:   { v: 'kai', speaker: 'KAI', text: 'Hot hands, homie!' },
  k_lowmp_1:  { v: 'kai', speaker: 'KAI', text: 'Mana is low... I require a little treat.' },
  k_ego_1:    { v: 'kai', speaker: 'KAI', text: 'I feel more powerful. And, somehow, more handsome.' },
  k_hurt_1:   { v: 'kai', speaker: 'KAI', text: 'Ow! Personal space!' },
  z_1:        { v: 'fiend', speaker: 'CRACKHEAD', text: 'Maaanaaa... gimme that maaanaaa...' },
  z_2:        { v: 'fiend', speaker: 'CRACKHEAD', text: 'Spare... spare fireballs, man...' },
  k_gate_1:   { v: 'kai', speaker: 'KAI', text: 'Not yet. A poet does not arrive unprepared. I need more inspiration.' },

  // ---- Party finale ----
  t_party_1:  { v: 'tyler', speaker: 'TYLER', text: 'AYYY, he made it! Kill the aux, kill the aux — the wizard is here!' },
  k_party_1:  { v: 'kai', speaker: 'KAI', text: "Hey, Venice. This one's called... Ollie Over My Heart." },
  k_poem_1:   { v: 'kai', speaker: 'KAI', text: 'I kissed the sky off a graffiti wall at sunset. The sky left me on read.' },
  k_poem_2:   { v: 'kai', speaker: 'KAI', text: 'Ube in my cup. Wasabi in my sinuses. Basil lime on the pavement. Love is a dropped scoop... and still I lick my dreams off the ground.' },
  k_poem_3:   { v: 'kai', speaker: 'KAI', text: 'They said get a real job. But my board sings on neon rails. My hands hold fire politely. And my dog believes in me.' },
  k_poem_4:   { v: 'kai', speaker: 'KAI', text: 'It is two a.m. in a backyard in Venice... and this is where the light lives. Snap for me. I am home.' },
  f_crowd_1:  { v: 'fan2', speaker: 'CROWD', text: 'SNAPS! SNAPS FOR THE WIZARD!' },
  n_outro_1:  { v: 'narrator', speaker: 'NARRATOR', text: 'And so the wizard spoke, and Venice listened. The end. Or at least... until the next open mic.' },
};

// Sound effects: id -> { prompt, seconds }
export const SFX_DEFS = {
  fireball_cast: { prompt: 'quick magical fireball whoosh being cast, arcane energy, video game', seconds: 1.0 },
  fireball_hit:  { prompt: 'small fiery explosion impact burst, punchy, arcade video game', seconds: 1.2 },
  jump:          { prompt: 'skateboard ollie, crisp tail pop snap and brief air', seconds: 0.8 },
  land:          { prompt: 'skateboard wheels landing on pavement with a solid thud and roll', seconds: 0.9 },
  grind:         { prompt: 'skateboard grinding a metal rail, continuous metallic scrape, seamless loop', seconds: 3.0 },
  roll:          { prompt: 'skateboard wheels rolling steadily on concrete, continuous, seamless loop', seconds: 4.0 },
  wall_jump:     { prompt: 'quick springy whoosh jump boost with a subtle magic shimmer', seconds: 0.7 },
  zombie_groan:  { prompt: 'raspy zombie groan, drawn out, creepy but comedic', seconds: 1.6 },
  zombie_hit:    { prompt: 'zombie pain grunt when struck, short', seconds: 0.7 },
  zombie_die:    { prompt: 'zombie defeated with a comedic deflating groan and a soft magical poof', seconds: 1.4 },
  pickup:        { prompt: 'sparkly magical chime, collectible pickup, bright and short', seconds: 0.9 },
  cash:          { prompt: 'coins jingle pickup with a tiny cash register ding', seconds: 0.8 },
  purchase:      { prompt: 'cash register cha-ching followed by a satisfied sparkle', seconds: 1.2 },
  dog_bark:      { prompt: 'happy medium dog barking twice, friendly', seconds: 1.0 },
  waves:         { prompt: 'gentle ocean waves rolling onto a beach with distant seagulls, seamless loop', seconds: 8.0 },
  slurp:         { prompt: 'a person sipping and slurping a drink, satisfied', seconds: 1.2 },
  cough:         { prompt: 'a man coughing fit after inhaling vape smoke, comedic', seconds: 1.8 },
  splat:         { prompt: 'a wet scoop of ice cream splatting onto pavement', seconds: 0.8 },
  snaps:         { prompt: 'a small crowd snapping fingers in applause at a poetry reading', seconds: 3.0 },
  ego_up:        { prompt: 'ascending magical power up shimmer, confident and warm', seconds: 1.5 },
  hurt:          { prompt: 'quick soft impact thump with a small grunt, video game player damage', seconds: 0.6 },
  explosion_big: { prompt: 'large magical fire explosion with crackling embers, video game', seconds: 1.8 },
  car_horn:      { prompt: 'car horn honking twice, sedan, angry, close', seconds: 1.0 },
  tire_screech:  { prompt: 'car tires screeching hard on asphalt while swerving, short', seconds: 1.3 },
};

// Music: id -> { prompt, ms }  (Eleven Music; falls back to SFX-loop generation)
export const MUSIC_DEFS = {
  day: {
    prompt: 'Sunny laid-back lofi hip hop instrumental. Warm Rhodes chords, mellow boom bap drums, vinyl crackle, breezy surf guitar licks. Skateboarding along a golden beach boardwalk in the afternoon. Chill, groovy, seamlessly loopable. Instrumental only.',
    ms: 60000,
  },
  night: {
    prompt: 'Moody synthwave lofi instrumental. Deep bass groove, dreamy analog synth pads, steady head-nod beat, distant electric piano. Skating empty neon streets at midnight, mysterious but cool. Seamlessly loopable. Instrumental only.',
    ms: 60000,
  },
  party: {
    prompt: 'Feel-good backyard house party instrumental. Four on the floor kick, warm piano house chords, funky bassline, hand claps, festive energy. Celebration at 2am under string lights. Seamlessly loopable. Instrumental only.',
    ms: 45000,
  },
  mixtape: {
    prompt: 'Intentionally goofy novelty comedy track: squeaky kazoo and recorder playing an annoyingly catchy off-key melody, cheap MIDI trumpet stabs, clunky drum machine, random cowbell hits, slide whistle, sounds like a boardwalk scam mixtape, so bad it is good. Seamlessly loopable. Instrumental only.',
    ms: 45000,
  },
};
