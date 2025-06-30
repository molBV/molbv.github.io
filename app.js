// ── 1) FIREBASE SETUP ───────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";

// add these two lines:
import { getAuth, signInAnonymously } 
  from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

import {
  getFirestore,
  collection, addDoc,
  query, orderBy, limit, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAnalytics, logEvent } 
  from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBa4dizIP5-_YpgJ3tyIPm20TB4T9xP9KM",
  authDomain: "ultimate-birdie.firebaseapp.com",
  projectId: "ultimate-birdie",
  storageBucket: "ultimate-birdie.firebasestorage.app",
  messagingSenderId: "1061733247954",
  appId: "1:1061733247954:web:5ad19583381cc09a7c760b",
  measurementId: "G-54KDN5XG60"
};

const app = initializeApp(firebaseConfig);

// ── ANONYMOUS SIGN-IN ───────────────────────────────────────
const auth = getAuth(app);
signInAnonymously(auth)
  .catch(err => console.error("Auth failed:", err));

// now analytics
const analytics = getAnalytics(app);
function trackEvent(eventName, params={}) {
  logEvent(analytics, eventName, params);
}
    

    const db  = getFirestore(app);

    const ADV_COLLECTION = "leaderboard";
    const MAR_COLLECTION = "leaderboard_marathon";

    // write a score
    async function saveGlobalScore(name, score, marathon = false) {
      const col = marathon ? MAR_COLLECTION : ADV_COLLECTION;
      const ls  = marathon ? 'birdyHighScoresMarathon' : 'birdyHighScores';
      try {
        await addDoc(collection(db, col), {
          name, score, ts: serverTimestamp()
        });
      } catch(e) {
        console.warn("Firestore write failed…", e);
        let hs = JSON.parse(localStorage.getItem(ls)||'[]');
        hs.push({name,score});
        localStorage.setItem(ls, JSON.stringify(hs));
      }
    }

    // fetch top-50
    async function fetchTopGlobalScores(marathon = false) {
      const col = marathon ? MAR_COLLECTION : ADV_COLLECTION;
      const ls  = marathon ? 'birdyHighScoresMarathon' : 'birdyHighScores';
      try {
        const q    = query(
          collection(db, col),
          orderBy("score","desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
      } catch(e) {
        console.warn("Firestore read failed…", e);
        return JSON.parse(localStorage.getItem(ls)||'[]')
                     .sort((a,b)=>b.score - a.score)
                     .slice(0,50);
      }
    }

    window.saveGlobalScore      = saveGlobalScore;
    window.fetchTopGlobalScores = fetchTopGlobalScores;


    // ── 2) GAME + AUDIO + RENDER LOOP ────────────────────────────
  (function(){
     // ── prevent any pending auto-hide from killing the name-entry prompt
  let achievementHideTimer;
  let bossRetryHandler = null;

        // ── Preload bird sprite ──
    const birdSprite = new Image();
    const ownedSkins = JSON.parse(localStorage.getItem('birdyOwnedSkins')||'{}');
    let defaultSkin = localStorage.getItem('birdySkin') || 'birdieV2.png';
    birdSprite.src = 'assets/' + defaultSkin;
    const DEFAULT_BIRD_FRAMES = ['assets/birdieV2.png', 'assets/birdieflap.png']
      .map(src => Object.assign(new Image(), { src }));
    const BAT_FRAMES = ['assets/batty1-min.png','assets/batty2-min.png','assets/batty3-min.png']
      .map(src => Object.assign(new Image(), { src }));
    const PENGUIN_FRAMES = ['assets/penguin1.png','assets/penguin2.png']
      .map(src => Object.assign(new Image(), { src }));
    const BAT_FLY = Object.assign(new Image(), { src:'assets/batty_fly-min.png' });
const bgLayers = {
  distant1: Object.assign(new Image(), { src: 'assets/background/distantisland1.png' }),
  distant2: Object.assign(new Image(), { src: 'assets/background/distantisland2.png' }),
  cloud1:   Object.assign(new Image(), { src: 'assets/background/cloud1.png' }),
  cloud2:   Object.assign(new Image(), { src: 'assets/background/cloud2.png' }),
  cloud3:   Object.assign(new Image(), { src: 'assets/background/cloud3.png' }),
  island1:  Object.assign(new Image(), { src: 'assets/background/island1.png' }),
  island2:  Object.assign(new Image(), { src: 'assets/background/island2.png' })
};

const islandImages = new Set([
  bgLayers.distant1,
  bgLayers.distant2,
  bgLayers.island1,
  bgLayers.island2
]);

const bgConfigs = [
  { img: bgLayers.distant2, scale: 1/6, speed: 0.2, alpha: 1, gap: 2,
    yMin: () => ORIGINAL_HEIGHT*0.45, yMax: () => ORIGINAL_HEIGHT*0.55 },
  { img: bgLayers.distant1, scale: 1/6, speed: 0.25, alpha: 1, gap: 2,
    yMin: () => ORIGINAL_HEIGHT*0.45, yMax: () => ORIGINAL_HEIGHT*0.55 },
  { img: bgLayers.cloud3,   scale: 0.5, speed: 0.4, alpha: 0.6, yMin: () => 0,              yMax: () => ORIGINAL_HEIGHT*0.4  },
  { img: bgLayers.cloud2,   scale: 0.5, speed: 0.6, alpha: 0.6, yMin: () => 0,              yMax: () => ORIGINAL_HEIGHT*0.4  },
  { img: bgLayers.cloud1,   scale: 0.5, speed: 0.8, alpha: 0.6, yMin: () => 0,              yMax: () => ORIGINAL_HEIGHT*0.4  },
  { img: bgLayers.island2,  scale: 0.25, speed: 1.0, alpha: 1, gap: 2,
    yMin: () => ORIGINAL_HEIGHT*0.5, yMax: () => ORIGINAL_HEIGHT*0.8 },
  { img: bgLayers.island1,  scale: 0.25, speed: 1.2, alpha: 1, gap: 2,
    yMin: () => ORIGINAL_HEIGHT*0.5, yMax: () => ORIGINAL_HEIGHT*0.8 }
];
let bgSprites = [];

function initBackgroundSprites() {
  bgSprites.length = 0;
  bgConfigs.forEach(cfg => {
    const w = (cfg.img.width || ORIGINAL_WIDTH) * cfg.scale;
    const spacing = w * (cfg.gap || 1);
    const count = Math.ceil(ORIGINAL_WIDTH / spacing) + 1;
    for (let i = 0; i < count; i++) {
      bgSprites.push({
        cfg,
        x: i * spacing,
        y: cfg.yMin() + Math.random() * (cfg.yMax() - cfg.yMin())
      });
    }
  });
}
Object.values(bgLayers).forEach(img => img.addEventListener('load', initBackgroundSprites));


    // → New “mecha” states
const mechaStages = [
  'assets/stage1.png',
  'assets/stage2.png',
  'assets/stage3.png',
  'assets/mecha_suit.png'
];
let mechaStage     = 0;      // 0..3, advance on each “bam”
let inMecha = false;  // final armored mode
let mechaStartScore = 0;
let mechaTriggered = false;
let transitionTimer= 0;      // ticks for staging
let mechaSafeExpiry = 0;     // frames until bounce‐only immunity expires
let bossEncounterCount = 0; // tracks boss encounters
let bossesDefeated    = 0; // number of times boss was beaten
let bossHitless       = false; // true if current boss fight had no hits

  // ── achievement tracking ──
  const achievementDefs = [
    { id:'pass20',   desc:'Pass 20 Pipes' },
    { id:'break20',  desc:'Break 20 Pipes' },
    { id:'coin10',   desc:'Collect 10 coins' },
    { id:'kill5',    desc:'Destroy 5 Jellyfish' },
    { id:'rocket3',  desc:'Get 3x Rocket Pickup' },
    { id:'score100', desc:'Get 100 Points' },
    { id:'boss1',    desc:'Beat Lv 1 Boss' },
    { id:'boss2',    desc:'Beat Lv 2 Boss' },
    { id:'boss1_nohit', desc:'Beat Lv 1 Boss Hitless' },
    { id:'boss2_nohit', desc:'Beat Lv 2 Boss Hitless' },
    { id:'boss3_nohit', desc:'Beat Lv 3 Boss Hitless' },
    { id:'score500', desc:'Get 500 Points' },
    { id:'coins500', desc:'Get 500 Coins' },
    { id:'mar100', desc:'Get 100 Points in Marathon' },
    { id:'mar250', desc:'Get 250 Points in Marathon' },
    { id:'mar500', desc:'Get 500 Points in Marathon' },
    { id:'story5',  desc:'Get 5 Story events \ud83d\udcd6' },
    { id:'story10', desc:'Get 10 Story events \ud83d\udcd6' },
    { id:'story15', desc:'Get 15 Story events \ud83d\udcd6' },
    { id:'story20', desc:'Get 20 Story events \ud83d\udcd6' }
  ];
let achievements = JSON.parse(localStorage.getItem('achievements')||'{}');

const storyEntries = [
  { id: 'Suit_Assembled', epithet: 'Feathersteel Oath', req: 'Collect 10 coins', log: [
      'As the tenth coin falls, a whisper of steel threads through your feathers.',
      'Plates burst forth, melding metal to bone, and your wings thunder with newfound might.',
      'Bound by this oath, the free sky feels thinner—your flight now guided by iron command.'
    ]},
  { id: 'Boss1_Appeared', epithet: 'Owl’s Gilded Vigil', req: 'Encounter the Owl boss', log: [
      'Shadows stir as the Owl’s watch begins—a sentinel of gears perched on ancient boughs.',
      'Its glowing eyes demand proof: the Mecha suit you wear, do you command it or merely bear it?',
      'Stand your ground, for failure here means caged by your own invention.'
    ]},
  { id: 'Boss1_Defeated', epithet: 'Shattered Gear-Heart’s Silence', req: 'Defeat the Owl', log: [
      'Your rockets rent the night—each blast a drumbeat of defiance against the Forest Warden.',
      'When its gear-heart gives way in a cascade of sparks, a fragment drifts into your grasp.',
      'Armor in hand, you feel the weight of triumph—and the chill of what you’ve forsaken.'
    ]},
  // ── NEW SIDE-ARC BEFORE THIRD OWL DEFEAT ──
  { id: 'Jelly_Vanquished', epithet: 'Echoes of the Electric Deep', req: 'Defeat 10 Jellyfish', log: [
      'Beneath waves of blue lightning, each flicker tests the steel coursing through your veins.',
      'With ten swift strikes, you rend the electric veil and silence the deep’s whispered currents.',
      'In their quiet aftermath, you harvest the strength for the trials yet to unfold.'
    ]},
  { id: 'Rocket_Rite', epithet: 'Ember-Spiral Covenant', req: 'Use Rocket Power 5 times', log: [
      'Your talons tremble as the first flare ignites—metal and feather conspire to rend the dawn itself.',
      'Five thunderous eruptions carve ribbons of embers across the sky’s silent canvas.',
      'Smoke coalesces in your wake—an ember-bound vow fueling the Owl’s Gilded Vigil.'
    ]},
  { id: 'Coin_Offering', epithet: 'Toll of Golden Remembrance', req: 'Collect 50 Coins', log: [
      'Fifty coins tumble like molten suns, each clinking with the echo of memories lost.',
      'Their warmth pulses against your feathers, whispering of promises both kept and broken.',
      'With this hoard in hand, the iron boughs loom ever closer—your ambition’s true cost.'
    ]},
  { id: 'Pipe_Beyond_Obstacles', epithet: 'Threshold of Iron Boughs', req: 'Break 15 Pipes', log: [
      'Fifteen ruptured conduits collapse beneath your charge, each fracture a note in your ascent.',
      'Through the wreckage, you glimpse the sky’s yearning call beyond these iron limbs.',
      'The path ahead shimmers with possibility—yet its edges are sharpened by resolve.'
    ]},
  { id: 'Arcane_Harmony', epithet: 'Aria of Alloy and Feather', req: 'Stay in Mecha for 30s', log: [
      'For thirty heartbeats, mech pulses align with your breath—a song of living alloy emerges.',
      'Steam and wing-beats weave in tandem, forging a harmony unbroken by doubt.',
      'In this crucible of fusion, you steel yourself for the Owl’s final crucible.'
    ]},
  // ── back into the Perseverance arc ──
  { id: 'Boss1_Perseverance', epithet: 'Resonance of Resolve', req: 'Beat the Owl three times', log: [
      'Three rematches carved in sparks—each clash colder, finer than the last.',
      'Your skill, honed razor-sharp by adversity, cuts with purpose, but chills your heart.',
      'Perseverance’s echo sings of victory—and of the suit’s growing claim upon your soul.'
    ]},
  { id: 'Pipe_Threshold_Reached', epithet: 'Hall of Iron Boughs', req: 'Pass 20 pipes', log: [
      'After twenty passages, you move through iron branches as an echo through time.',
      'Memories of free perches stir—yet these conduits now bear you skyward.',
      'Mastery entwines you deeper with metal’s unending demand.'
    ]},
  { id: 'Mecha_Mastery', epithet: 'Pulse of Living Alloy', req: 'Stay in Mecha for 60s', log: [
      'Sixty seconds entwined with mech’s pulse—you and steel breathe as one.',
      'Engine’s thrum reverberates like a heartbeat, reminding you of reliance.',
      'In this bond lies immense power—and the dread of its possible silence.'
    ]},
  { id: 'Boss2_Appeared', epithet: 'Forge Titan’s Emberstride', req: 'Encounter the Forge Titan', log: [
      'From molten forges emerges a stag of iron—each step scorched with ambition.',
      'Its molten core burns with the fire you once commanded within.',
      'To stand against it is to confront your own fervor untempered by restraint.'
    ]},
  { id: 'Boss2_Defeated', epithet: 'Ashfall of the Furnace Heart', req: 'Defeat the Forge Titan', log: [
      'Your final blast douses its blazing core, steam hissing over cooling steel.',
      'A single ember drops to your palm—a living spark of your own desire.',
      'As its heat fades, regret flickers at the edges of your triumph.'
    ]},
  { id: 'Boss2_Revive_Drop', epithet: 'Dawnthief’s Crystal', req: 'Forge Titan drops Revive', log: [
      'From the Titan’s ashes, a crystalline dawn trembles in your grasp.',
      'Its glow promises life once more—for a price no soul escapes untouched.',
      'May you spend this gift wisely, for death’s debt is ever patient.'
    ]},
  { id: 'Revive_Used', epithet: 'Second Heartbeat’s Whisper', req: 'Use the Revive token', log: [
      'Darkness nearly claims you—then light floods your veins as life is reclaimed.',
      'Chest heaving, you stand again—a testament to fate’s fragile bargain.',
      'Yet each heartbeat now tastes of obsession, each breath a borrowed gift.'
    ]},
  { id: 'Pipe_Breaker', epithet: 'Relentless Shatter', req: 'Break 20 pipes', log: [
      'Twenty shattered pipes fall in thunderous revolt beneath your charge.',
      'Metal splinters like silent vows—each fracture leaves its mark on the wind.',
      'In this destruction, you glimpse paths uncharted—roads forged by will alone.'
    ]},
  { id: 'Coin_Threshold', epithet: 'Ring of Remembered Suns', req: 'Collect 100 total coins', log: [
      'One hundred coins whirl in a golden ring—their warmth tinged with nostalgia.',
      'Each orb holds a memory of dawns past, bright and fleeting.',
      'Yet in clutching them, you bind yourself to endless yearning.'
    ]},
  { id: 'Gauntlet_Cleared', epithet: 'Glitch Gauntlet’s Passage', req: 'Clear the Glitch Gauntlet', log: [
      'Static crackles as you breach the gauntlet—pipes flicker in digital flux.',
      'Blueprints of the Architect reveal themselves in fractured code.',
      'Navigating here is to chart the contours of your own fractured mind.'
    ]},
  { id: 'Architect_Appeared', epithet: 'Null Architect’s Reflection', req: 'Encounter the Null Architect', log: [
      'In the maze’s core, a mirror forms—the Architect’s gaze twisted by void.',
      'Its voice slices the air: “I embody the fear you dare not name.”',
      'Confront it, and reclaim each shard of your fractured identity.'
    ]},
  { id: 'Architect_Defeated', epithet: 'Echoed Shardfall', req: 'Defeat the Null Architect', log: [
      'Your strike scatters shards of neon—each a fragment of self.',
      'One shard drifts to rest in your palm, etched with the name “Avius.”',
      'Yet half the mirror remains fractured—a story not yet whole.'
    ]},
  { id: 'Self_Glimpse', epithet: 'Revelation of Feather and Steel', req: 'Glimpse your true self', log: [
      'A breath catches as you glimpse true form—feather and steel in living meld.',
      'Your name resonates: Avius, Stormbird of the Celestial Grove.',
      'Still, the final form waits—to test your unity of soul and machine.'
    ]},
  { id: 'Prime_Appeared', epithet: 'Shadowed Dawn of Prime', req: 'Encounter Avius Prime', log: [
      'From twilight’s edge, Avius Prime steps forth—light and steel intertwined.',
      'Every power you’ve claimed, every regret you’ve borne, glows within its chest orb.',
      'Its gaze commands: reconcile bird and machine, or fade into legend.'
    ]},
  { id: 'Prime_Titan_Defeated', epithet: 'Echo of Cast-Off Weight', req: 'Defeat Prime Titan phase', log: [
      'The Titan’s titan-phase falls—sparks shower like silent benedictions.',
      'You peel away the gaunt armor—a shedding of burdens long carried.',
      'Now the true crucible awaits: to embrace what endures beyond metal.'
    ]},
  { id: 'Prime_Ascendant', epithet: 'Ascendance of Featherblade', req: 'Reach Prime Ascendant', log: [
      'Feathers refine into blades of living light—each flap a stroke of rebirth.',
      'You dance through the sky with joyous grace, a hymn woven in motion.',
      'In this flight, bird and machine finally sing as one.'
    ]},
  { id: 'Prime_Final_Defeated', epithet: 'Dawn’s Wholeness Resonance', req: 'Defeat Avius Prime', log: [
      'With final pulse, Avius Prime dissolves into dawn’s gentle lumen.',
      'Feather and metal hum together—kin stitched by triumph and insight.',
      'Free from cycles of obsession, you return to the pipes—master of your own story.'
    ]}
];

  let storyLog = JSON.parse(localStorage.getItem('storyLog')||'{}');
  function checkStoryAchievements() {
    const count = Object.keys(storyLog).length;
    if (count >= 5)  unlockAchievement('story5');
    if (count >= 10) unlockAchievement('story10');
    if (count >= 15) unlockAchievement('story15');
    if (count >= 20) unlockAchievement('story20');
  }
  checkStoryAchievements();
  let slowMoTimer = 0;
  let mechaStartFrame = 0;
  let gauntletCoinStart = 0;
  let gauntletRocketStart = 0;

  let runPipes=0, runCoins=0, runJellies=0, runPowerups=0, runPipeBreaks=0;

let marathonMode = false;
let gauntletMode = false;
let marathonMoving = false;

  const menuEl = document.getElementById('menu');

  function startAdventure(){
    marathonMode = false;
    gauntletMode = false;
    if(adventurePlays<=0){
      showAchievement("No birds left");
      menuEl.style.display = "block";
      return;
    }
    adventurePlays--;
    localStorage.setItem("birdyAdventurePlays", adventurePlays);
    recordAdventureUse();
    updateAdventureInfo();
    menuEl.style.display = 'none';
    if (storedDoubles > 0) {
      storedDoubles--;
      localStorage.setItem('birdyDouble', storedDoubles);
      doubleActive = true;
    }
    if (spinMagnet) {
      magnetActive = true;
      spinMagnet = 0;
      localStorage.removeItem('spinMagnet');
      addEffectIcon('magnet','assets/Magnet.png');
    }
    if (spinTriple) {
      tripleShot = true;
      spinTriple = 0;
      localStorage.removeItem('spinTriple');
      addEffectIcon('triple','assets/rocket1.png');
    }
    if (spinHeavy) {
      heavyLoadActive = true;
      spinHeavy = 0;
      localStorage.removeItem('spinHeavy');
      heavyBall.x = bird.x + 40;
      heavyBall.y = bird.y + 40;
      addEffectIcon('heavy','assets/ball.png');
    }
    if (spinPipeMove) {
      marathonMoving = true;
      pipeMoveActive = true;
      spinPipeMove = 0;
      localStorage.removeItem('spinPipeMove');
      addEffectIcon('pipe','assets/pipe_move.png');
    }
    if (spinStinky) {
      scareJellyActive = true;
      spinStinky = 0;
      localStorage.removeItem('spinStinky');
      addEffectIcon('stinky','assets/stinky.png');
    }
    state = STATE.Play;
    trackEvent('game_start');
  }

  function startMarathon(){
    marathonMode = true;
    gauntletMode = false;
    menuEl.style.display = 'none';
    if (storedDoubles > 0) {
      storedDoubles--;
      localStorage.setItem('birdyDouble', storedDoubles);
      doubleActive = true;
    }
    if (spinMagnet) {
      magnetActive = true;
      spinMagnet = 0;
      localStorage.removeItem('spinMagnet');
      addEffectIcon('magnet','assets/Magnet.png');
    }
    if (spinTriple) {
      tripleShot = true;
      spinTriple = 0;
      localStorage.removeItem('spinTriple');
      addEffectIcon('triple','assets/rocket1.png');
    }
    if (spinHeavy) {
      heavyLoadActive = true;
      spinHeavy = 0;
      localStorage.removeItem('spinHeavy');
      heavyBall.x = bird.x + 40;
      heavyBall.y = bird.y + 40;
      addEffectIcon('heavy','assets/ball.png');
    }
    if (spinPipeMove) {
      marathonMoving = true;
      pipeMoveActive = true;
      spinPipeMove = 0;
      localStorage.removeItem('spinPipeMove');
      addEffectIcon('pipe','assets/pipe_move.png');
    }
    if (spinStinky) {
      scareJellyActive = true;
      spinStinky = 0;
      localStorage.removeItem('spinStinky');
      addEffectIcon('stinky','assets/stinky.png');
    }
    state = STATE.Play;
    trackEvent('game_start_marathon');
  }

  function startGauntlet(){
    marathonMode = false;
    gauntletMode = true;
    menuEl.style.display = 'none';
    if (storedDoubles > 0) {
      storedDoubles--;
      localStorage.setItem('birdyDouble', storedDoubles);
      doubleActive = true;
    }
    if (spinMagnet) {
      magnetActive = true;
      spinMagnet = 0;
      localStorage.removeItem('spinMagnet');
      addEffectIcon('magnet','assets/Magnet.png');
    }
    if (spinTriple) {
      tripleShot = true;
      spinTriple = 0;
      localStorage.removeItem('spinTriple');
      addEffectIcon('triple','assets/rocket1.png');
    }
    if (spinHeavy) {
      heavyLoadActive = true;
      spinHeavy = 0;
      localStorage.removeItem('spinHeavy');
      heavyBall.x = bird.x + 40;
      heavyBall.y = bird.y + 40;
      addEffectIcon('heavy','assets/ball.png');
    }
    if (spinPipeMove) {
      marathonMoving = true;
      pipeMoveActive = true;
      spinPipeMove = 0;
      localStorage.removeItem('spinPipeMove');
      addEffectIcon('pipe','assets/pipe_move.png');
    }
    if (spinStinky) {
      scareJellyActive = true;
      spinStinky = 0;
      localStorage.removeItem('spinStinky');
      addEffectIcon('stinky','assets/stinky.png');
    }
    coinCount = 10;
    mechaTriggered = true;
    state = STATE.MechaTransit;
    startMechaTransition();
    trackEvent('game_start_gauntlet');
  }

  document.getElementById('btnAdventure').onclick = startAdventure;
  document.getElementById('btnMarathon').onclick  = startMarathon;
  document.getElementById('btnGauntlet').onclick  = startGauntlet;
  document.getElementById('btnAchievements').onclick = () => {
    menuEl.style.display = 'none';
    showAchievementsList();
  };
  document.getElementById('btnStory').onclick = () => {
    menuEl.style.display = 'none';
    showStoryLog();
  };
  document.getElementById('btnShop').onclick = () => {
    menuEl.style.display = 'none';
    showShop();
  };
    const leaderboardBtn = document.getElementById("btnLeaderboard");
    if(leaderboardBtn){
      leaderboardBtn.onclick = () => {
        menuEl.style.display = "none";
        Promise.all([
          fetchTopGlobalScores(false),
          fetchTopGlobalScores(true)
        ]).then(([adv, mar]) => {
          const ov = document.getElementById("overlay");
          ov.style.display = "block";
          showHighScores(adv, mar, true);
        });
      };
    }

  const buyBtn = document.getElementById("buyBirdBtn");
  if(buyBtn){
    buyBtn.onclick = () => {
      if(adventurePlays >= ADVENTURE_MAX){
        showAchievement("Birds full");
      } else if(totalCoins >= 20){
        totalCoins -= 20;
        adventurePlays = Math.min(adventurePlays + 1, ADVENTURE_MAX);
        localStorage.setItem("birdyCoinsEarned", totalCoins);
        localStorage.setItem("birdyAdventurePlays", adventurePlays);
        updateScore();
        updateAdventureInfo();
        updateCoins();
      } else {
        showAchievement("Not enough coins");
      }
    };
  }
  // boss frames: phase 1 vs. phase 2
  const bossFramesS1 = ['frame0','frame1','frame2']
    .map(f => Object.assign(new Image(), { src:`assets/boss_animation/${f}.png` }));
const bossFramesS2 = ['boss_S2_0','boss_S2_1','boss_S2_2', 'boss_S2_3']
  .map(f => Object.assign(new Image(), { src:`assets/boss_animation/${f}.png` }));

const bossFramesS3 = ['null_architect','null_charge','null_slice1','null_slice2']
  .map(f => Object.assign(new Image(), { src:`assets/boss_animation/${f}.png` }));
const bossFramesS4 = ['shocky','shocky.charge1','shocky.charge2']
  .map(f => Object.assign(new Image(), { src:`assets/boss_animation/${f}.png` }));
  const sliceSprite = Object.assign(new Image(), { src:'assets/boss_animation/SliceAttach.png' });

  // charging‐rocket “attach” sprite for phase 2
  //const bossRocketAttachS2 = new Image();
  //bossRocketAttachS2.src = 'assets/boss_animation/boss_s2_charge.png';

  // only used in boss fight #2+
const activeHomingImg = new Image();
activeHomingImg.src   = 'assets/boss_animation/active_homing.png';

//Start off pointing at phase-1:
let bossFrames = bossFramesS1;

const rocketOutSprite = new Image();
rocketOutSprite.src   = 'assets/rocket1.png';
const rocketInSprite  = new Image();
rocketInSprite.src    = 'assets/rocket2.png';
const fireRocketSprite = new Image();
fireRocketSprite.src  = 'assets/fire_rocket.png';
const iceRocketSprite  = new Image();
iceRocketSprite.src   = 'assets/ice_rocket.png';
const shockRocketSprite = new Image();
shockRocketSprite.src = 'assets/boss_animation/actual_shock_rocket.png';
const cowRocketSprite = new Image();
cowRocketSprite.src   = 'assets/cow_rocket.png';
const BAT_ROCKET_FRAMES = ['assets/bat_rocket1.png','assets/bat_rocket2.png']
  .map(src => Object.assign(new Image(), { src }));
const cowPipeImg      = new Image();
cowPipeImg.src        = 'assets/cow_pipe.png';
const iceColumnImg    = new Image();
iceColumnImg.src      = 'assets/ice_column.png';
const fireColumnImg   = new Image();
fireColumnImg.src     = 'assets/fire_column.png';
const storyColumnImg  = new Image();
storyColumnImg.src    = 'assets/story_column.png';
const cowUpSprite     = new Image();
cowUpSprite.src       = 'assets/cow_up.png';
const cowDownSprite   = new Image();
cowDownSprite.src     = 'assets/cow_down.png';
const cheeseKillerSprite = new Image();
cheeseKillerSprite.src  = 'assets/cheeesekiller.png';
const cheeseChargeSprite = new Image();
cheeseChargeSprite.src  = 'assets/cheekillercharge.png';
const CHEESE_KILLER_MAX_HP = 2000;
const penguinMechaBase    = new Image();
penguinMechaBase.src      = 'assets/penguinmechaBase.png';
const penguinMechaShoot1  = new Image();
penguinMechaShoot1.src    = 'assets/penguinmechashoot1.png';
const penguinMechaShoot2  = new Image();
penguinMechaShoot2.src    = 'assets/penguinmechashoot2.png';
const penguinRocketSprite = new Image();
penguinRocketSprite.src   = 'assets/penguin_rocket.png';
const snowflakeImg        = new Image();
snowflakeImg.src          = 'assets/snowflake.png';
const pipeCloudCanvas = document.createElement('canvas');
pipeCloudCanvas.width = pipeCloudCanvas.height = 32;
const pipeCloudCtx = pipeCloudCanvas.getContext('2d');
pipeCloudCtx.fillStyle = 'rgba(255,255,255,0.6)';
pipeCloudCtx.beginPath();
pipeCloudCtx.arc(12,18,8,0,Math.PI*2);
pipeCloudCtx.arc(20,14,8,0,Math.PI*2);
pipeCloudCtx.arc(24,20,6,0,Math.PI*2);
pipeCloudCtx.fill();
const cloudOverlay    = new Image();
cloudOverlay.src      = pipeCloudCanvas.toDataURL();
const mechaMusic      = new Audio('assets/boss_fight.mp3'); //mecha_theme
const explosionSfx  = new Audio('assets/explosion.mp3');
explosionSfx.preload = 'auto';
explosionSfx.volume  = 0.4;
const explosionImgs = [
  Object.assign(new Image(), { src: 'assets/explosion1.png' }),
  Object.assign(new Image(), { src: 'assets/explosion2.png' })
];
const explosions = [];
const impactParticles = [];
const armorPiece1   = new Image(); armorPiece1.src = 'assets/mecharmor1.png';
const armorPiece2   = new Image(); armorPiece2.src = 'assets/mecharmor2.png';
    // ── boss sprites & rockets ──
//const bossFrames = (bossEncounterCount > 1 ? bossFramesS2 : bossFramesS1);
const bossRockets  = ['boss_rocket1','boss_rocket2'].map(r=>Object.assign(new Image(),{src:`assets/boss_animation/${r}.png`}));
const bombSprite   = Object.assign(new Image(),{src:'assets/boss_animation/bomb.png'});
const slicingDiskSprite = Object.assign(new Image(),{src:'assets/slicingdisk.png'});
const flyingArmor   = [];
const stage2Bombs = [];  // boss-2 special slow bombs
// ── jellyfish sprites ──
const jellyFrames = ['assets/jelly1.png','assets/jelly2.png','assets/jelly3.png'].map(src=>Object.assign(new Image(),{src}));
const jellyShockFrames = ['assets/jelly.shock1.png','assets/jelly.shock2.png','assets/jelly.shock3.png'].map(src=>Object.assign(new Image(),{src}));
const jellies = [];
const slicingDisks = [];

// ── money leaf images ──
const leafImages = ['assets/bill1.png','assets/biill2.png','assets/bill3.png','assets/bill4.png']
  .map(src => Object.assign(new Image(), { src }));

mechaMusic.loop       = true;
mechaMusic.preload    = 'auto';
    // ── Strong‐attack bomb queues ─────────────────────────────
const tossBombs   = [];   // upward‐toss bombs
    const radialBombs = [];   // 8‐way fragments


    // ── Responsive canvas setup ──
    const canvas = document.getElementById('gameCanvas'),
          ctx    = canvas.getContext('2d');
            // ── score-save & overlay-lock flags ─────────────────────────
  const overlay = document.getElementById('overlay');
  let hasSubmittedScore = false;
  let overlayTop10Lock  = false;

  // click-outside: auto-save once, then only close if NOT top-50
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      if (!hasSubmittedScore) {
        saveGlobalScore('Anon', score);
        trackEvent('submit_score', { score });
        hasSubmittedScore = true;
      }
      if (!overlayTop10Lock) {
        overlay.style.display = 'none';
        if (state === STATE.Over) resetGame();
      }
    }
  });

  function outsideScreenHandler(e) {
    if (state === STATE.Over && !overlay.contains(e.target)) {
      if (!hasSubmittedScore) {
        saveGlobalScore('Anon', score);
        trackEvent('submit_score', { score });
        hasSubmittedScore = true;
      }
      if (!overlayTop10Lock) {
        overlay.style.display = 'none';
        resetGame();
      }
    }
  }
  document.addEventListener('mousedown', outsideScreenHandler);
  document.addEventListener('touchstart', outsideScreenHandler, { passive:true });

  const spinOverlay = document.getElementById('spinOverlay');
  const coinDisplay = document.getElementById('coinDisplay');
  const spinCoinDisplay = document.getElementById('spinCoinDisplay');
  const spinBtn = document.getElementById('spin-btn');
  spinOverlay.addEventListener('click', e => {
    if (spinOverlayClickable && e.target === spinOverlay) closeSpinOverlay();
  });


    // ── Audio: background music + SFX context ──
    // dummy chord function (no-op)
function playChord(/* chordType, startTime */) {}
const bgMusic = document.getElementById('bgMusic');
let globalVolume = parseFloat(localStorage.getItem('birdyVolume') || '0.5');
bgMusic.volume = globalVolume;
mechaMusic.volume = globalVolume;
explosionSfx.volume = 0.4 * globalVolume;

// simple WebAudioContext for playTone()
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// play bgMusic once upon first user interaction
function initMusic() {
    bgMusic.load();             // kick off buffering immediately
  bgMusic.play()
    .then(()=>console.log('Music started'))
    .catch(e=>console.error('Play() failed:', e))
  document.removeEventListener('mousedown', initMusic);
  document.removeEventListener('keydown',   initMusic);
}
document.addEventListener('mousedown', initMusic, {passive:true});
document.addEventListener('keydown',   initMusic, {passive:true});

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        bgMusic.pause();
        mechaMusic.pause();
      } else if (!paused) {
        if (state === STATE.Boss || inMecha || state === STATE.MechaTransit) {
          mechaMusic.play().catch(()=>{});
        } else {
          bgMusic.play().catch(()=>{});
        }
      }
    });

    const ORIGINAL_WIDTH  = canvas.width,
          ORIGINAL_HEIGHT = canvas.height;
    function resizeCanvas(){
      const scale = Math.min(
        window.innerWidth  / ORIGINAL_WIDTH,
        window.innerHeight / ORIGINAL_HEIGHT
      );
      const dispW = ORIGINAL_WIDTH * scale,
            dispH = ORIGINAL_HEIGHT * scale;
      canvas.style.width  = dispW + 'px';
      canvas.style.height = dispH + 'px';
      canvas.style.left   = (window.innerWidth  - dispW) / 2 + 'px';
      canvas.style.top    = (window.innerHeight - dispH) / 2 + 'px';
      initBackgroundSprites();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();



    // ── Simple SFX ──
    function playTone(freq, dur=0.1){
      const o = audioCtx.createOscillator(),
            g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.07, audioCtx.currentTime);
      o.start(); o.stop(audioCtx.currentTime + dur);
    }

    // ── Canvas & State (from V6.8) :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}
    const scoreEl = document.getElementById('score');
    const reviveCountEl = document.getElementById('reviveCount');
    const settingsBtn = document.getElementById('btnSettings');
    const settingsPanel = document.getElementById('settingsPanel');
    const volumeSlider = document.getElementById('volumeSlider');
    volumeSlider.value = globalVolume;
    const spinSound = document.getElementById('spinSound');
    const explosionSound = document.getElementById('explosionSound');
    const winSound = document.getElementById('winSound');
    const loseSound = document.getElementById('loseSound');
    const pauseBtn = document.getElementById('btnPause');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const resumeBtn = document.getElementById('resumeBtn');
    const mainMenuBtn = document.getElementById('mainMenuBtn');
    const resumeTimerEl = document.getElementById('resumeTimer');

    function applyVolume() {
      bgMusic.volume = globalVolume;
      mechaMusic.volume = globalVolume;
      explosionSfx.volume = 0.4 * globalVolume;
      explosionSound.volume = globalVolume;
      winSound.volume = globalVolume;
      loseSound.volume = globalVolume;
      spinSound.volume = globalVolume;

    }
    applyVolume();

    function openSettings() {
      if (paused) return;
      paused = true;
      settingsPanel.style.display = 'block';
      cancelAnimationFrame(animationId);
      bgMusic.pause();
      mechaMusic.pause();
    }

    function closeSettings() {
      if (!paused) return;
      settingsPanel.style.display = 'none';
      paused = false;
      if (state === STATE.Boss || inMecha || state === STATE.MechaTransit) {
        mechaMusic.play().catch(()=>{});
      } else {
        bgMusic.play().catch(()=>{});
      }
      loop();
    }

    settingsBtn.onclick = () => {
      if (paused) closeSettings();
      else openSettings();
    };

    volumeSlider.oninput = e => {
      globalVolume = parseFloat(e.target.value);
      localStorage.setItem('birdyVolume', globalVolume);
      applyVolume();
    };

    function openPause() {
      if (paused) return;
      paused = true;
      pauseOverlay.style.display = 'block';
      cancelAnimationFrame(animationId);
      bgMusic.pause();
      mechaMusic.pause();
    }

    function resumeGame() {
      pauseOverlay.style.display = 'none';
      resumeTimerEl.style.display = 'none';
      paused = false;
      if (state === STATE.Boss || inMecha || state === STATE.MechaTransit) {
        mechaMusic.play().catch(()=>{});
      } else {
        bgMusic.play().catch(()=>{});
      }
      loop();
    }

    pauseBtn.onclick = openPause;
    resumeBtn.onclick = resumeGame;
    mainMenuBtn.onclick = () => {
      pauseOverlay.style.display = 'none';
      paused = false;
      resetGame();
    };


    document.getElementById('spin-btn').onclick = () => {
      if (adventurePlays <= 0) {
        showAchievement('No birds left');
        return;
      }
      startRoulette();
    };

    const W = ORIGINAL_WIDTH, H = ORIGINAL_HEIGHT;
const STATE = {
  Start:0,
  Play:1,
  Over:2,
  MechaTransit:3,
  Boss:4,
  BossExplode:5
};

// core game state
let state      = STATE.Start;
let frames     = 0;
let score      = 0;
let superTimer = 0;
let shieldCount= 0;
let pipeCount  = 0;
let paused     = false;
let animationId;

// boss fight state
let bossActive      = false;
let bossHealth      = 500;
let bossMaxHealth   = 500;
//let birdBossHP      = 2;    // how many hits bird can take
let bossRocketCount = 0;    // count rockets you’ve broken
let bossRocketThreshold = 60; // rockets needed for next boss trigger
let bossTriggerMisses  = 0;   // times a boss rocket despawned unhit
let bossTriggerActive  = false; // is a boss trigger rocket on-screen
let bossObj;                // boss-specific timers & mode
let bossExplosionTimer = 0; // countdown for boss defeat explosion

let cheeseKiller = null;
let topStayTimer = 0;

let altMecha = null;        // 'fire', 'aqua', 'story', or 'money' during alt mech transition
let altMechaTimer = 0;
    const baseAppleProb=0.03,baseCoinProb=0.18;
    const cycleLength=6000;
    const stars=[]; for(let i=0;i<50;i++) stars.push({ x:Math.random()*W, y:Math.random()*(H*0.5) });
    const dayColor1='#70d0ee', dayColor2='#8ff1f5', nightColor1='#000011', nightColor2='#001133';
    const pipes=[], apples=[], coins=[];
    const appleR=10, coinR=8, initialGap=300, minGap=154, pipeW=60, baseSpeed=2;
    let coinCount=0, coinBoostExpiries=[], currentSpeed=baseSpeed, speedFlashTimer = 0;
    let mechSpeed = baseSpeed;
    const pipeColors=['#2E7D32','#1565C0','#D84315','#6A1B9A','#F9A825'];
    const movingPipeChanceBase   = 0.3;  // initial chance a pipe oscillates
    const movingPipeChanceActive = 0.6;  // after movement unlocked
    const pipeMoveAmplitude = 15;   // max up/down movement in pixels
    const pipeMoveSpeed = 0.04;     // radians per frame
    const pipeClouds=[], trees=[];
    const rocketsOut = [];
    const rocketsIn  = [];
    const rocketPowerups = [];
    const rocketSymbols = [];
    const shockDrops = [];
const rocketParticles = [];
const rocketSmoke = [];
const rocketFlames = [];
const rocketSnow = [];
const columnFlames = [];
const columnSnow = [];
const skinParticles = [];
const snowflakes = [];
const moneyLeaves = [];
const milkParticles = [];
const staggerSparks = [];
const batThrust = [];
const sonarRings = [];
const miniRockets = [];
const batSwarms = [];
const pulseRings = [];

    let tripleShot = false;
    let rocketsSpawned = 0;       // count rockets during Mecha

    // cooldown so the boss radial shot only drains one coin even if
    // multiple fragments hit on the same frame
    let radialHitCooldown = 0;

    // spawn rate for the triple rocket power‑up. We want it to be
    // more common than apples but not quite as common as coins
    const baseTripleProb = 0.25;
    const rocketPowerR   = 16;
    const rocketSymbolR  = 12;

    let specialRocket = null;

    let personalBest = parseInt(localStorage.getItem('birdyBestScore')) || 0;
    let lastPlayerName = localStorage.getItem('birdyName') || '';
    let totalCoins   = parseInt(localStorage.getItem('birdyCoinsEarned')) || 0;
      if (totalCoins >= 500) unlockAchievement('coins500');
    document.getElementById('coinDisplay').textContent = totalCoins;
    document.getElementById('bestScore').textContent = personalBest;
    let storedRevives = parseInt(localStorage.getItem('birdyRevives')||'0');
    let storedDoubles = parseInt(localStorage.getItem('birdyDouble')||'0');
    let spinMagnet  = parseInt(localStorage.getItem('spinMagnet')||'0');
    let spinTriple  = parseInt(localStorage.getItem('spinTriple')||'0');
    let spinHeavy   = parseInt(localStorage.getItem('spinHeavy')||'0');
    let spinPipeMove= parseInt(localStorage.getItem('spinPipeMove')||'0');
    let spinStinky  = parseInt(localStorage.getItem('spinStinky')||'0');
    let heavyLoadActive = false;
    let pipeMoveActive  = false;
    let scareJellyActive= false;
    const smellParticles = [];
    const ballImg = Object.assign(new Image(), { src:'assets/ball.png' });
    const heavyBall = { x:0, y:0, vx:0, vy:0 };
    if (spinMagnet) addEffectIcon('magnet','assets/Magnet.png');
    if (spinTriple) addEffectIcon('triple','assets/rocket1.png');
    if (spinHeavy) addEffectIcon('heavy','assets/ball.png');
    if (spinPipeMove) addEffectIcon('pipe','assets/pipe_move.png');
    if (spinStinky) addEffectIcon('stinky','assets/stinky.png');
    let usedRevive    = false;
    let reviveTimer   = 0;
    const reviveRings = [];
    let doubleActive  = false;
    const doubleRings = [];
    let doublePulse   = 0;
    const magnetParticles = [];
    let electricTimer = 0;
    let tripleElectric = false;
    let spinReturnToMenu = false;
    let spinForRevive = false;
    let spinOverlayClickable = false;
    let nextSpin = null;
    let prevMusic = null;
    const ADVENTURE_MAX     = 20;
    const ADVENTURE_RECHARGE = 1800000; // 30 minutes
    let adventurePlays = parseInt(localStorage.getItem("birdyAdventurePlays") || "20");
    let adventureStamp = parseInt(localStorage.getItem("birdyAdventureStamp") || Date.now());
    adventurePlays = Math.min(adventurePlays + 5, ADVENTURE_MAX);
    localStorage.setItem("birdyAdventurePlays", adventurePlays);

    function regenAdventurePlays(){
      const now = Date.now();
      if(adventurePlays < ADVENTURE_MAX){
        const diff = now - adventureStamp;
        if(diff >= ADVENTURE_RECHARGE){
          const add = Math.min(ADVENTURE_MAX - adventurePlays, Math.floor(diff / ADVENTURE_RECHARGE));
          adventurePlays += add;
          adventureStamp += ADVENTURE_RECHARGE * add;
          localStorage.setItem("birdyAdventurePlays", adventurePlays);
        }
        localStorage.setItem("birdyAdventureStamp", adventureStamp);
      }
    }
    regenAdventurePlays();

    function recordAdventureUse(){
      if(adventurePlays < ADVENTURE_MAX){
        adventureStamp = Date.now();
        localStorage.setItem("birdyAdventureStamp", adventureStamp);
      }
    }

    const electricRings = [];
    const electricBolts = [];

    const symbols = [
      { id: 'Revive',        icon: 'assets/Revive.png',       weight: 10 },
      { id: 'DoubleCoins',   icon: 'assets/Double.png',       weight: 10 },
      { id: 'Magnet',        icon: '🧲',                      weight: 10 },
      { id: 'TripleRockets', icon: 'assets/rocket1.png',      weight: 10 },
      { id: 'Coin1',         icon: '1',                       weight: 15 },
      { id: 'Coin5',         icon: '5',                       weight: 15 },
      { id: 'Coin10',        icon: '10',                      weight: 5  },
      { id: 'Coin50',        icon: '50',                      weight: 5  }
    ];
    symbols.forEach(s => {
      if (s.icon.startsWith('assets')) {
        const img = new Image();
        img.src = s.icon;
        s.node = img;
      } else {
        const div = document.createElement('div');
        div.textContent = s.icon;
        s.node = div;
      }
    });

    // ── Upgrade state ──
    let coinSpawnBonus   = 0;
    let rocketSizeMult   = 1;
    let rocketDamageMult = 1;
    let rocketFlameEnabled = false;
    let rocketSplash     = false;
    let magnetActive     = false;
    let ownedUpgrades = JSON.parse(localStorage.getItem('ownedUpgrades') || '[]');
    if(!ownedUpgrades.length){
      const legacy = JSON.parse(localStorage.getItem('purchasedUpgrades') || '[]');
      if(legacy.length){
        // legacy data used numeric indices; map them to new upgrade IDs
        const idMap = [
          'natural_coin10', 'natural_coin20', 'natural_slots', 'natural_magnet',
          'mech_rocket_big', 'mech_rocket_splash', 'mech_rocket_pulse'
        ];
        ownedUpgrades = legacy.map(v => typeof v === 'number' ? idMap[v] : v);
        localStorage.setItem('ownedUpgrades', JSON.stringify(ownedUpgrades));
      }
    }
    let equippedUpgrades = JSON.parse(localStorage.getItem('equippedUpgrades') || '[]');
    if(!equippedUpgrades.length && ownedUpgrades.length){
      equippedUpgrades = ownedUpgrades.slice(0,2);
      localStorage.setItem('equippedUpgrades', JSON.stringify(equippedUpgrades));
    }
    let equipSlots = 2;
    let rocketPulseUpgrade = false;
    let discModeTimer = 0;

    const upgradeTreeConfig = [
      {
        id: 'natural',
        name: 'Coin Path',
        color: '#FFD700',
        costBase: 50,
        upgrades: [
          {
            id: 'natural_coin10',
            name: '+10% Coin Luck',
            description: 'Coins appear 10% more often',
            effect: () => { coinSpawnBonus += 0.10; },
            costFactor: 1,
            tier: 0,
            icon: 'coins10up.png',
            x: 0,
            y: 0
          },
          {
            id: 'natural_coin20',
            name: '+10% More Coins',
            description: 'Coins appear 10% more often',
            effect: () => { coinSpawnBonus += 0.10; },
            costFactor: 1.1,
            tier: 1,
            parent: 'natural_coin10',
            icon: 'coins10up.png',
            x: -1,
            y: 1
          },
          {
            id: 'natural_magnet',
            name: '🧲 Magnetism',
            description: 'Coins are drawn to you',
            effect: () => { magnetActive = true; },
            costFactor: 1.2,
            tier: 1,
            parent: 'natural_coin10',
            icon: 'magnetup.png',
            x: 1,
            y: 1
          },
          {
            id: 'natural_slots',
            name: 'Equip 2 More',
            description: 'Equip 2 additional abilities',
            effect: () => { equipSlots += 2; },
            costFactor: 1.2,
            tier: 2,
            parent: 'natural_magnet',
            icon: 'doubleup.png',
            x: 1,
            y: 2
          }
        ]
      },
      {
        id: 'mech',
        name: 'Rocket Path',
        color: '#800000',
        costBase: 100,
        upgrades: [
          {
            id: 'mech_rocket_big',
            name: 'Bigger Rockets',
            description: 'Larger rockets deal more damage',
            effect: () => {
              rocketSizeMult   *= 1.5;
              rocketDamageMult *= 1.5;
              rocketFlameEnabled = true;
            },
            costFactor: 1,
            tier: 0,
            icon: 'big_rocket.png',
            x: 3,
            y: 0
          }
        ]
      }
    ];

    function applyEquippedUpgrades() {
      coinSpawnBonus   = 0;
      rocketSizeMult   = 1;
      rocketDamageMult = 1;
      rocketFlameEnabled = false;
      rocketSplash     = false;
      magnetActive     = false;
      rocketPulseUpgrade = false;
      equipSlots = 2;
      upgradeTreeConfig.forEach(branch => {
        branch.upgrades.forEach(upg => {
          if (equippedUpgrades.includes(upg.id)) upg.effect();
        });
      });
      if (ownedUpgrades.includes('mech_rocket_pulse')) rocketPulseUpgrade = true;
      equippedUpgrades = equippedUpgrades.slice(0, equipSlots);
    }
    applyEquippedUpgrades();
    updateReviveDisplay();

    // tooltip element for upgrade tree
    const tip = document.createElement('div');
    tip.style.position = 'absolute';
    tip.style.left = '50%';
    tip.style.bottom = '10px';
    tip.style.transform = 'translateX(-50%)';
    tip.style.background = 'rgba(0,0,0,0.8)';
    tip.style.color = '#fff';
    tip.style.padding = '4px 8px';
    tip.style.borderRadius = '4px';
    tip.style.pointerEvents = 'none';
    tip.style.opacity = 0;
    tip.style.transition = 'opacity .1s';
    document.getElementById('overlay').appendChild(tip);
    function showTooltip(text) {
      tip.textContent = text;
      tip.style.opacity = 1;
    }
    function hideTooltip() { tip.style.opacity = 0; }

    for(let i=0;i<6;i++){
      pipeClouds.push({ x: W + Math.random()*800, y: 50+Math.random()*150, speed: 3+Math.random()*2 });
      trees.push({ x:Math.random()*W, h:50+Math.random()*80 });
    }

    // ── Utility functions (from V6.8) :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}
    function hexToRgb(hex){ hex=hex.replace('#',''); if(hex.length===3) hex=hex.split('').map(h=>h+h).join(''); return { r:parseInt(hex.slice(0,2),16), g:parseInt(hex.slice(2,4),16), b:parseInt(hex.slice(4,6),16) }; }
    function rgbToHex(r,g,b){ return '#' + [r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join(''); }
    function lerpColor(a,b,t){ const ca=hexToRgb(a), cb=hexToRgb(b); return rgbToHex(ca.r+(cb.r-ca.r)*t, ca.g+(cb.g-ca.g)*t, ca.b+(cb.b-ca.b)*t); }
    function shade(col,amt){ if(col[0]==='#') col=col.slice(1); const num=parseInt(col,16), r=(num>>16)+amt, g=((num>>8)&255)+amt, b=(num&255)+amt; const rr=Math.max(0,Math.min(255,r)), gg=Math.max(0,Math.min(255,g)), bb=Math.max(0,Math.min(255,b)); return '#'+((rr<<16)|(gg<<8)|bb).toString(16).padStart(6,'0'); }

    function isFireSkin(){
      return defaultSkin === 'FireSkinBase.png' || birdSprite.src.includes('FireSkinMech');
    }

    function isAquaSkin(){
      return defaultSkin === 'AquaSkinBase.png' || birdSprite.src.includes('AquaSkinMech');
    }

    function isStorySkin(){
      return defaultSkin === 'story_bird.png' || birdSprite.src.includes('Story_mech');
    }

    function isBatSkin(){
      return defaultSkin === 'batty1-min.png' || birdSprite.src.includes('mech_bat');
    }

    function isPenguinSkin(){
      return defaultSkin === 'penguin1.png' || birdSprite.src.includes('penguinmecha');
    }
// ── Mecha-transition kick-off ───────────────────────────────
function startMechaTransition() {
  transitionTimer = 0;
  mechaStage      = 0;
  inMecha         = false;
  altMecha        = null;
  altMechaTimer   = 0;
  // swap music
  bgMusic.pause();
  mechaMusic.load();
  mechaMusic.play().catch(()=>{
    // if autoplay is blocked, retry on the next click
    // schedule one retry on next click of the single mecha track:
    bossRetryHandler = () => mechaMusic.play().catch(()=>{});
    document.addEventListener('mousedown', bossRetryHandler, { once:true });
  });

  if (defaultSkin === 'FireSkinBase.png') {
    altMecha = 'fire';
    altMechaTimer = 90;
  } else if (defaultSkin === 'AquaSkinBase.png') {
    altMecha = 'aqua';
    altMechaTimer = 90;
  } else if (defaultSkin === 'cow_down.png') {
    altMecha = 'cow';
    altMechaTimer = 90;
  } else if (defaultSkin === 'story_bird.png') {
    altMecha = 'story';
    altMechaTimer = 90;
  } else if (defaultSkin === 'batty1-min.png') {
    altMecha = 'bat';
    altMechaTimer = 90;
  } else if (defaultSkin === 'MoneySkin.png') {
    altMecha = 'money';
    altMechaTimer = 90;
  } else if (defaultSkin === 'penguin1.png') {
    altMecha = 'penguin';
    altMechaTimer = 90;
  }
}
function startBossFight() {
bossEncounterCount++;
  bossHitless = true;
  if (bossEncounterCount === 1) triggerStoryEvent('Boss1_Appeared');
  else if (bossEncounterCount === 2) triggerStoryEvent('Boss2_Appeared');
  else if (bossEncounterCount === 3) triggerStoryEvent('Architect_Appeared');
  else if (bossEncounterCount === 4) triggerStoryEvent('Prime_Appeared');
  // …and pick the right art for this fight:
  bossFrames = bossEncounterCount === 1
    ? bossFramesS1
    : bossEncounterCount === 2
      ? bossFramesS2
      : bossEncounterCount === 3
        ? bossFramesS3
        : bossFramesS4;
trackEvent('boss_fight_start');
  bgMusic.pause();
  mechaMusic.play().catch(() => {});
  bossActive       = true;
  state            = STATE.Boss;
  bossMaxHealth    = bossEncounterCount === 1
    ? 500
    : bossEncounterCount === 2
      ? 750
      : bossEncounterCount === 3
        ? 1500
        : 2000;
  bossHealth       = bossMaxHealth;
  bossTriggerActive = false;
  bossTriggerMisses = 0;
  bossRocketThreshold = 60;
  bossRocketCount = 0;
  //birdBossHP       = 2;
  // freeze main environment:
// freeze main environment:
pipes.length     = apples.length = coins.length = 0;
  slicingDisks.length = 0;
   inMecha          = false;
  // position bird at left
  //bird.x           = 80;
  //bird.y           = H/2;
  // init boss object
  bossObj = {
    //y: H/2, vy:0,
       // start off screen at right
   x: W + 32,    // assuming p.r is 32
   y: H/2,
   vx: -6,       // your “fly-in” speed
   vy: 0,
    r: 32,
    mode:'random', modeTimer:0, modeDuration:300,
    isCharging:false, chargeTimer:0, chargeDuration:60, shakeMag:0,
    justFired:false, smoke: [],
    secondAttackTriggered: false,   // flag for one‐time trigger
    strongQueue: 0,
    flashTimer: 0,
    pushX: 0,
    pushY: 0,
    burnTimer: 0,
    slowStacks: 0,
  freezeTimer: 0
  ,chargeCooldown:0
  ,sliceCooldown:180
  ,firePipeCooldown:180
  ,tripleFire:false
  ,isSlicing:false
  ,sliceStage:0
  ,sliceTimer:0
  ,aggressive:false
  ,sliceRepeat:0
    ,oscPhase:0
    ,baseY:H/2
    ,stunTimer:0
  ,bigCharge:false
  ,phase2:false
    };
  showAchievement('🚀 Boss Incoming!');

}
  function updateBoss() {
    // 1) Smoke puffs
    const p = bossObj;
    if (bossEncounterCount === 4 && !p.phase2 && bossHealth <= bossMaxHealth/2) {
      p.phase2 = true;
      p.modeDuration *= 0.5;
      showAchievement('Stormbreaker Phase!');
      triggerShake(15);
    }
    if(p.stunTimer>0){
      p.stunTimer--;
      if(p.stunTimer===0) p.isCharging=false;
      if(frames % 3 === 0){
        spawnImpactParticles(p.x + (Math.random()-0.5)*p.r, p.y + (Math.random()-0.5)*p.r, 0,0);
        p.smoke.push({ x:p.x + (Math.random()-0.5)*p.r, y:p.y + (Math.random()-0.5)*p.r, alpha:1, r:6, dark:true });
        electricRings.push({x:p.x,y:p.y,r:30,alpha:0.4,color:'gray'});
      }
      if(frames % 2 === 0) spawnStaggerSpark(p.x, p.y);
      // continue updating so the boss doesn't freeze
    }
    const speedFactor = p.freezeTimer > 0 ? 0 : 1 - p.slowStacks * 0.1;
  if (p.freezeTimer > 0) p.freezeTimer--;
  if (p.chargeCooldown > 0) p.chargeCooldown--;
  if (p.sliceCooldown > 0) p.sliceCooldown--;
  if (p.firePipeCooldown > 0) p.firePipeCooldown--;
  if (bossHealth <= bossMaxHealth/2) p.aggressive = true;
  if (p.burnTimer > 0) {
    p.burnTimer--;
    if (frames % 30 === 0) {
      bossHealth -= 2;
      if (bossHealth <= 0) endBossFight(true);
    }
  }
  if (p.slowStacks === 5 && p.freezeTimer === 0 && Math.random() < 0.02) {
    p.freezeTimer = 60;
    p.slowStacks = 0;
  }
    // 0) fly in until you're at your fighting X position:
  const targetX = W - 80;
  if (p.x > targetX) {
    p.x += p.vx * speedFactor;           // moves left by 6px/frame
//    if (p.pushX) { p.x += p.pushX; p.pushX *= 0.8; }
//    if (p.pushY) { p.y += p.pushY; p.pushY *= 0.8; }
//    return;                // skip the rest until you arrive
 // } else {
        if (p.x < targetX) p.x = targetX;
  } else if (p.x < targetX) {
    p.x = targetX;
  }
  if (frames % 5 === 0) {
    p.smoke.push({ x:p.x + Math.sin(p.y*0.04)*30 + p.r, y:p.y, alpha:1, r:4 });
    if (bossEncounterCount === 3)
      p.smoke.push({ x:p.x, y:p.y + p.r, alpha:1, r:3, vy:2 });
  }
  for (let i=p.smoke.length-1;i>=0;i--){
    const s=p.smoke[i];
    s.y += s.vy || 0;
    s.r+=0.3; s.alpha-=0.02;
    if (s.alpha<=0) p.smoke.splice(i,1);
  }

  // apply hit pushback with decay
//  if (p.pushX) { p.x += p.pushX; p.pushX *= 0.8; }
 // if (p.pushY) { p.y += p.pushY; p.pushY *= 0.8; }
if (p.pushX || p.pushY) {
    p.x += p.pushX;
    p.y += p.pushY;
    p.pushX *= 0.8;
    p.pushY *= 0.8;
    if (Math.abs(p.pushX) < 0.01) p.pushX = 0;
    if (Math.abs(p.pushY) < 0.01) p.pushY = 0;
  }
  // gently move back toward base position
  p.x += (targetX - p.x) * 0.1 * speedFactor;
  // 2) Switch mode & auto‐attack faster when damaged
  p.modeTimer++;
  if (p.modeTimer > p.modeDuration) {
    p.mode = p.mode==='random'?'track':'random';
    p.modeDuration = bossEncounterCount === 3
      ? 40 + (bossHealth/bossMaxHealth)*120
      : 60 + (bossHealth/bossMaxHealth)*200;
    p.modeTimer = 0;
    if (p.mode==='track') triggerBossAttack();
  }
  if (bossEncounterCount === 4 && p.aggressive && frames % 120 === 0) {
    spawnJelly();
  }

  if (bossEncounterCount === 3 && p.aggressive && p.firePipeCooldown <= 0) {
    spawnFirePipe();
    spawnFirePipe();
    p.firePipeCooldown = 300;
  }

  if (bossEncounterCount === 3 && !p.isCharging && !p.isSlicing && p.sliceCooldown <= 0 && Math.random() < 0.05) {
    p.isSlicing = true;
    p.sliceRepeat = 2;
    p.sliceStage = 0;
    p.sliceTimer = 0;
    p.sliceCooldown = 240;
  }


  // 3) Move boss Y — punish bird in top 10% by drifting down then tossing an upward radial bomb
  if (bird.y < H * 0.1) {
    p.vy += 0.2 * speedFactor;
    p.y  += p.vy * speedFactor;
    p.vy *= 0.95;
    p.y = Math.max(p.r, Math.min(H - p.r, p.y));
    if (bossEncounterCount === 3 && !p.isSlicing) {
      p.sliceRepeat = 3;
      p.isSlicing = true;
      p.sliceStage = 0;
      p.sliceTimer = 0;
    } else if (bossEncounterCount !== 3 && frames % 60 === 0) {
      tossBombs.push({
        x:   p.x + Math.sin(p.y * 0.04) * 30,
        y:   p.y,
        vy:  -12,
        r:    12,
        exploded: false
      });
    }
  }
  else {
    // normal tracking / random drift
    if (p.mode === 'track') {
      p.vy += (bird.y - p.y) * 0.008 * speedFactor;
    } else {
      p.vy += (Math.random() - 0.5) * 0.2 * speedFactor;
    }
    if (bossEncounterCount === 3) {
      p.vy += Math.sin(frames*0.05) * 0.1;
    }
    p.y  += p.vy * speedFactor;
    p.vy *= 0.95;
    p.y   = Math.max(p.r, Math.min(H - p.r, p.y));
  }


  // 4) Charging & firing
  if (p.isCharging) {
    triggerShake(p.shakeMag);
    p.chargeTimer++;
    if (p.chargeTimer>=p.chargeDuration){
      const offs = bossEncounterCount===3 && p.tripleFire ? [-12,0,12] : [0];
      offs.forEach(o=>{
        const yOff = bossEncounterCount===3 ? (Math.random()-0.5)*40 : 0;
        rocketsIn.push({
          x: p.x + Math.sin(p.y*0.04)*30 - p.r,
          y: p.y + o + yOff,
          vx: bossEncounterCount===4 && p.bigCharge ? -5 : -6,
          isBossShot:true,
          architect: bossEncounterCount===3,
          shock: bossEncounterCount===4,
          electric: bossEncounterCount===4,
          big: bossEncounterCount===4 && p.bigCharge,
          coinLoss: p.tripleFire ? 3 : 1
        });
        if (bossEncounterCount===4) {
          rocketsIn.push({
            x: p.x + Math.sin(p.y*0.04)*30 - p.r,
            y: p.y + o + yOff,
            vx: -2,
            isBossShot:true,
            pulseRush:true
          });
        }
      });
      electricRings.push({ x:p.x, y:p.y, r:p.r*1.5, alpha:0.8, color:'cyan' });
      triggerShake(10);
      spawnImpactParticles(p.x, p.y, 0, 0);
      // removed radial disk attack
      p.isCharging=false; p.shakeMag=0; p.justFired=true; p.tripleFire=false;
      if (bossEncounterCount === 3 && p.aggressive && p.firePipeCooldown <= 0) {
        spawnFirePipe();
        spawnFirePipe();
        p.firePipeCooldown = 300;
      }
      if (bossEncounterCount === 4 && p.aggressive) {
        for (let w=0; w<3; w++) spawnJelly();
      }
      // ── STRONG ATTACK: three radial bomb tosses in a row ──
if (p.strongQueue > 0) {
  // spawn exactly p.strongQueue bombs
  for (let i = 0; i < p.strongQueue; i++) {
    tossBombs.push({
      x: p.x + Math.sin(p.y*0.04)*30,
      y: p.y,
      vy: -12, r:12, exploded:false
    });
  }
    p.strongQueue = 0;
}

    }
  }

  if (p.isSlicing) {
    p.sliceTimer++;
    if (p.sliceStage === 0 && p.sliceTimer > 15) p.sliceStage = 1;
    if (p.sliceStage === 1 && p.sliceTimer > 25) {
      rocketsIn.push({
        x: p.x - p.r,
        y: p.y,
        vx: -8,
        isBossShot: true,
        isSlice: true,
        coinLoss: 1
      });
      if (p.sliceRepeat && --p.sliceRepeat > 0) {
        p.y -= 20;
        p.sliceTimer = 0;
        p.sliceStage = 0;
      } else {
        p.isSlicing = false;
        p.sliceTimer = 0;
        p.sliceStage = 0;
      }
    }
  }

  // 5) Handle bossShots hitting bird
  rocketsIn.forEach((r,i)=>{
  if (!r.isBossShot) return;
  if (Math.hypot(bird.x-r.x, bird.y-r.y) < 24) {
    rocketsIn.splice(i,1);
    tripleShot = false;
    tripleElectric = false;
    electricTimer = 0;
    const loss = r.coinLoss || 1;
    if (coinCount >= loss) {
      coinCount -= loss;
      updateScore();
      playTone(1000, 0.2);
    } else {
      endGame();
    }
  }
});


  // 6) Check bossHP←birdShots collisions
  rocketsOut.forEach((b,i)=>{
    if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 8) {
      rocketsOut.splice(i,1);
        spawnExplosion(p.x, p.y, false, b.electric);
        if (b.type === 'cow') spawnMilkSplash(p.x, p.y);
        maybeDropCoin(p.x, p.y);
        triggerShake(8);
        spawnImpactParticles(p.x, p.y, p.x - b.x, p.y - b.y);
      const mag = Math.hypot(p.x - b.x, p.y - b.y) || 1;
      p.pushX += (p.x - b.x) / mag * 4;
      p.pushY += (p.y - b.y) / mag * 4;
      p.flashTimer = 6;
      if (b.type === 'fire') p.burnTimer = 120;
      if (b.type === 'ice') p.slowStacks = Math.min(p.slowStacks + 1, 5);
      let dmg = (b.damage || 10);
      if (bossEncounterCount === 3) {
        if (defaultSkin === 'FireSkinBase.png') dmg *= 0.5;
        if (defaultSkin === 'AquaSkinBase.png') dmg *= 2;
      }
        bossHealth -= dmg;
        if(Math.random() < 0.1){
          p.stunTimer = 60;
          p.isCharging = true;
          triggerShake(2);
          spawnImpactParticles(p.x, p.y, 0, 0);
          p.smoke.push({ x:p.x, y:p.y, alpha:1, r:4 });
          const dropX = Math.min(W - 20, p.x + p.r + 20);
          if(Math.random() < 0.5) coins.push({x:dropX,y:p.y,taken:false});
          else rocketPowerups.push({x:dropX,y:p.y,taken:false});
        }
        if (bossEncounterCount === 3 && p.chargeCooldown <= 0) {
        p.tripleFire = true;
        p.isCharging = true;
        p.chargeTimer = 0;
        p.chargeDuration = 30;
        p.shakeMag = p.aggressive ? 12 : 8;
        p.chargeCooldown = 180;
      }
      if (bossHealth<=0) endBossFight(true);
    }
  });
  slicingDisks.forEach((d,i)=>{
    if(d.enemy) return;
    if (Math.hypot(d.x - p.x, d.y - p.y) < p.r + 24) {
      slicingDisks.splice(i,1);
      spawnExplosion(p.x, p.y, false, d.pulse);
      maybeDropCoin(p.x, p.y);
      triggerShake(8);
      spawnImpactParticles(p.x, p.y, p.x - d.x, p.y - d.y);
      const mag = Math.hypot(p.x - d.x, p.y - d.y) || 1;
      p.pushX += (p.x - d.x) / mag * 4;
      p.pushY += (p.y - d.y) / mag * 4;
      p.flashTimer = 6;
      let dmg = d.damage || 10;
      if (bossEncounterCount === 3) {
        if (defaultSkin === 'FireSkinBase.png') dmg *= 0.5;
        if (defaultSkin === 'AquaSkinBase.png') dmg *= 2;
      }
      bossHealth -= dmg;
      if(Math.random() < 0.1){
        p.stunTimer = 60;
        p.isCharging = true;
        triggerShake(2);
        spawnImpactParticles(p.x, p.y, 0, 0);
        p.smoke.push({ x:p.x, y:p.y, alpha:1, r:4 });
        const dropX2 = Math.min(W - 20, p.x + p.r + 20);
        if(Math.random() < 0.5) coins.push({x:dropX2,y:p.y,taken:false});
        else rocketPowerups.push({x:dropX2,y:p.y,taken:false});
      }
      if (bossHealth<=0) endBossFight(true);
    }
  });
      // ── update tossBombs: toss upward then explode into fragments ──
  for (let i = tossBombs.length - 1; i >= 0; i--) {
    const b = tossBombs[i];
    b.vy += 0.4; b.y += b.vy;
    // explode either at apex (vy>0) or the instant it would go above the top edge:
    if (!b.exploded && (b.vy > 0 || b.y - b.r < 0)) {
      b.exploded = true;
      // clamp to the very top so fragments spawn on‐screen:
      b.y = Math.max(b.r, b.y);

      // spawn 8‐way fragments
      for (let k = 0; k < 8; k++) {
        const ang = (Math.PI * 2 / 8) * k;
        radialBombs.push({
          x:  b.x,
          y:  b.y,
          r:  8,
          vx: Math.cos(ang) * 5,
          vy: Math.sin(ang) * 5
        });
      }
      tossBombs.splice(i,1);
    }
  }

  // ── update radialBombs: simple straight‐line shards ──
// ── update radialBombs: simple straight‐line shards + damage ──
for (let i = radialBombs.length - 1; i >= 0; i--) {
  const b = radialBombs[i];
  b.x += b.vx;
  b.y += b.vy;

  // 1) collision with bird?
  if (Math.hypot(bird.x - b.x, bird.y - b.y) < bird.rad + b.r) {
    if (radialHitCooldown <= 0) {
      handleHit();
      radialHitCooldown = 10; // short immunity window
    }
    radialBombs.splice(i, 1);
    continue;
  }

  // 2) off-screen cleanup
  if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
    radialBombs.splice(i, 1);
  }
}


}





function triggerBossAttack(){
  const p=bossObj;
  p.isCharging   = true;
  p.chargeTimer  = 0;
  if (bossEncounterCount === 4 && p.aggressive && Math.random() < 0.7) {
    p.bigCharge = true;
    p.chargeDuration = 40;
  } else {
    p.bigCharge = false;
    p.chargeDuration = bossEncounterCount === 3 ? 30 : bossEncounterCount === 4 ? 30 : 20 + (bossHealth/bossMaxHealth)*40;
  }
  p.shakeMag     = bossEncounterCount === 3 && p.aggressive ? 10 : bossEncounterCount === 4 ? 6 : 5;

  if (bossEncounterCount === 2 && Math.random() < 0.5) {
    // spawn a slow bomb at the boss’s mouth
    stage2Bombs.push({
      x: p.x + Math.sin(p.y*0.04)*30 - 8,
      y: p.y,
      vx: -0.5,     // slow float
      hits: 0       // count of times the player hit it
    });
  } else {
    if (bossEncounterCount === 1 && bossHealth <= bossMaxHealth * 0.8) p.strongQueue = 3;
  }
}


   function endBossFight(victory) {
    if (bossRetryHandler) {
      document.removeEventListener('mousedown', bossRetryHandler);
      bossRetryHandler = null;
    }
  bossActive = false;
  if (victory) {
    trackEvent('boss_defeated', { score });
    bossesDefeated++;
    if (bossesDefeated === 1) triggerStoryEvent('Boss1_Defeated');
    if (bossesDefeated === 2) {
      triggerStoryEvent('Boss2_Defeated');
      triggerStoryEvent('Boss2_Revive_Drop');
      storedRevives = 1;
      localStorage.setItem('birdyRevives', storedRevives);
      updateReviveDisplay();
    }
    if (bossesDefeated >= 3 && !storyLog['Boss1_Perseverance']) {
      triggerStoryEvent('Boss1_Perseverance');
    }
    if (bossesDefeated === 1) {
      unlockAchievement('boss1');
      if (bossHitless) unlockAchievement('boss1_nohit');
    }
    if (bossesDefeated === 2) {
      unlockAchievement('boss2');
      if (bossHitless) unlockAchievement('boss2_nohit');
    }
    if (bossesDefeated === 3 && bossHitless) {
      unlockAchievement('boss3_nohit');
    }
    score += 50;
    mechaMusic.pause();
    mechaMusic.currentTime = 0;
    for (let i=0;i<5;i++) {
      spawnExplosion(bossObj.x - bossObj.r + i*(bossObj.r*0.4), bossObj.y + (Math.random()*20-10));
    }
    explosionSfx.currentTime = 0;
    explosionSfx.play();
    triggerShake(10);
    bossExplosionTimer = 180;
    state = STATE.BossExplode;
  } else {
    state = STATE.Play;
  }
  bossRocketCount = 0;
  bossTriggerActive = false;
  bossTriggerMisses = 0;
  bossRocketThreshold = 60;

  // switch back to normal music
  if(!gauntletMode){
    mechaMusic.pause();
    bgMusic.play();

    // — after boss fight, retain one coin & lose suit —
    coinCount       = 1;
    inMecha         = false;
    mechaTriggered  = false;
    tripleShot      = false;
    birdSprite.src  = 'assets/' + defaultSkin;
    mechSpeed       = baseSpeed;
    flyingArmor.push({ img: armorPiece1, x: bird.x, y: bird.y, vx:-2, vy:-3 });
    flyingArmor.push({ img: armorPiece2, x: bird.x, y: bird.y, vx: 2, vy:-3 });
    updateScore();
  }

  // clear lingering projectiles
  radialBombs.length = 0;
  tossBombs.length   = 0;
  stage2Bombs.length = 0;
  bossHitless = false;
}


function drawBoss() {
    // ── draw tossBomb projectiles ──
  tossBombs.forEach(b => {
      // glow
  const glow = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*2);
  // Inner circle: fully opaque yellow
glow.addColorStop(0, 'rgba(255,200,0,1)');       // was 0.6 → 1.0

// Mid‐point: still bright but starting to fade
glow.addColorStop(0.5, 'rgba(255,200,0,0.8)');   // new “halfway” stop

// Outer edge: fade out completely
glow.addColorStop(1, 'rgba(255,200,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 3, 0, Math.PI * 2);
  ctx.fill();
    ctx.drawImage(
      bombSprite,
      b.x - b.r, b.y - b.r,
      b.r*2, b.r*2
    );
  });

  // ── draw radialBomb fragments ──
// ── draw radialBomb fragments with glow ──
radialBombs.forEach(b => {
  // 1) Draw a radial‐gradient “glow” behind the fragment:
  const glowRadius = b.r * 3; // make the glow extend farther than the sprite
  const glow = ctx.createRadialGradient(
    b.x, b.y, 0,
    b.x, b.y, glowRadius
  );
  glow.addColorStop(0,   'rgba(255,200,0,1)');   // fully bright at center
  glow.addColorStop(0.5, 'rgba(255,200,0,0.8)'); // still bright halfway out
  glow.addColorStop(1,   'rgba(255,200,0,0)');   // fade to transparent at edge

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(b.x, b.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2) Optionally, you can still keep a small shadow for extra pop:
  ctx.save();
  ctx.shadowBlur  = 20;
  ctx.shadowColor = 'rgba(255,200,0,0.6)';
  ctx.drawImage(
    bombSprite,
    b.x - b.r/2,
    b.y - b.r/2,
    b.r,
    b.r
  );
  ctx.restore();
});



  const p=bossObj;
  // a) draw background smoke
  p.smoke.forEach(s=>{
    ctx.save();
      ctx.globalAlpha=s.alpha;
      ctx.fillStyle=s.dark?'#222':'grey';
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,2*Math.PI);
      ctx.fill();
    ctx.restore();
  });

  // b) draw bird & main UI
  bird.draw();  // reuse your bird.draw()

    // c) draw boss frames flipped (with 1.5× scale on encounter #2)
  let frame;
  if (bossEncounterCount === 1) {
    frame = p.justFired ? 2 : (p.isCharging ? 1 : 0);
  } else if (bossEncounterCount === 2) {
    if      (p.isHomingAttack) frame = 3;
    else if (p.justFired)      frame = 2;
    else if (p.isCharging)     frame = 1;
    else                       frame = 0;
  } else if (bossEncounterCount === 3) {
    if (p.isSlicing)           frame = p.sliceStage === 0 ? 2 : 3;
    else if (p.isCharging)     frame = 1;
    else                       frame = 0;
  } else {
    frame = p.isCharging ? (Math.floor(p.chargeTimer/10)%2 ? 2 : 1) : 0;
  }

  // determine bossScale: 1.0 for fight #1, 1.5 for fight #2+
  const bossScale = bossEncounterCount > 1 ? 1.5 : 1;
  // compute drawing size
  const size = p.r * 2 * bossScale;

  const sx = p.stunTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
  const sy = p.stunTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
  ctx.save();
    ctx.translate(
      p.x + Math.sin(p.y * 0.04) * 30 + sx,
      p.y + sy
    );
    ctx.scale(-1, 1);
    if (p.phase2) ctx.filter = 'hue-rotate(180deg) brightness(1.2)';
    if (p.flashTimer > 0 && Math.floor(p.flashTimer/2)%2===0) {
      ctx.filter = 'brightness(2)';
    }
    // draw centered at the new size
    ctx.drawImage(
      bossFrames[frame],
      -size/2, -size/2,
       size,    size
    );
    if (p.slowStacks > 0 || p.freezeTimer > 0) {
      ctx.globalAlpha = 0.3 + 0.1 * p.slowStacks;
      ctx.fillStyle = 'rgba(100,180,255,0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, size/2, 0, Math.PI*2);
      ctx.fill();
    }
    if (p.burnTimer > 0) {
      ctx.globalAlpha = p.burnTimer / 120 * 0.5;
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      ctx.arc(0, 0, size/2, 0, Math.PI*2);
      ctx.fill();
    }
  ctx.restore();
  if (p.flashTimer > 0) p.flashTimer--;

  // draw attach-rocket (also scaled) if charging
// only draw a charge‐sprite on the second boss fight
//if (p.isCharging && bossEncounterCount > 1) {
  //const w = bossRocketAttachS2.width  * bossScale;
  //const h = bossRocketAttachS2.height * bossScale;
  //const x = (W - 80 + Math.sin(p.y*0.04)*30) - w/2;
  //const y = p.y - h/2;
 // ctx.drawImage(bossRocketAttachS2, x, y, w, h);
//}



  p.justFired = false;

  // d) draw health bar
  const bx = p.x + Math.sin(p.y*0.04)*30, barW=80;
  ctx.fillStyle='#444';
  ctx.fillRect(bx-barW/2, p.y-p.r-20, barW,6);
  ctx.fillStyle='lime';
  ctx.fillRect(bx-barW/2, p.y-p.r-20, barW*(bossHealth/bossMaxHealth),6);
}


    // ── Background drawing ──
    function drawCloud(x,y,s){ ctx.save(); ctx.translate(x,y); ctx.scale(s,s); ctx.fillStyle='rgba(255,255,255,0.8)'; [0,30,60].forEach(px=>{ ctx.beginPath(); ctx.arc(px,0,20,0,2*Math.PI); ctx.fill(); }); ctx.restore(); }
    function drawTree(x,base,h){ ctx.fillStyle='#8D6E63'; ctx.fillRect(x,base-h,10,h); ctx.fillStyle='#388E3C'; ctx.beginPath(); ctx.moveTo(x-15,base-h+20); ctx.lineTo(x+5,base-h-20); ctx.lineTo(x+25,base-h+20); ctx.closePath(); ctx.fill(); }
function drawBackground(){
  // normalized time: 0→1 over cycleLength frames
  const tC = (frames % cycleLength) / cycleLength;
  // ease between day (0) and night (1) for sky colors
  const wN = Math.sin(Math.PI * tC);

  // 1) draw sky gradient
  const topC = lerpColor(dayColor1, nightColor1, wN);
  const botC = lerpColor(dayColor2, nightColor2, wN);
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, topC);
  grad.addColorStop(1, botC);
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // 2) parallax sprites
  bgSprites.forEach(sp => {
    const img = sp.cfg.img;
    const w   = (img.width || ORIGINAL_WIDTH) * sp.cfg.scale;
    const h   = (img.height || ORIGINAL_HEIGHT) * sp.cfg.scale;
    sp.x -= sp.cfg.speed;
    if (sp.x + w < 0) {
      const same = bgSprites.filter(o => o.cfg === sp.cfg);
      const maxX = Math.max(...same.map(o => o.x));
      const spacing = w * (sp.cfg.gap || 1);
      sp.x = maxX + spacing;
      sp.y = sp.cfg.yMin() + Math.random() * (sp.cfg.yMax() - sp.cfg.yMin());
    }
    ctx.save();
    ctx.globalAlpha = sp.cfg.alpha;
    ctx.drawImage(img, sp.x, sp.y, w, h);
    ctx.restore();
  });
  ctx.save();
  ctx.fillStyle = `rgba(0,30,60,${wN*0.5})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 3) sun / moon path
  const sunR  = 30, moonR = 25;
  if (tC <= 0.5) {
    // sun: tC [0→0.5] → phaseSun [0→1]
    const phaseSun = tC / 0.5;
    // travel from x = -sunR → x = W+sunR
    const arcX = phaseSun * (W + 2*sunR) - sunR;
    const arcY = 150 - 100 * Math.sin(Math.PI * phaseSun);
    ctx.globalAlpha = 1;
    ctx.fillStyle   = 'yellow';
    ctx.beginPath();
    ctx.arc(arcX, arcY, sunR, 0, 2*Math.PI);
    ctx.fill();
  } else {
    // moon: tC [0.5→1] → phaseMoon [0→1]
    const phaseMoon = (tC - 0.5) / 0.5;
    const arcX = phaseMoon * (W + 2*moonR) - moonR;
    const arcY = 150 - 100 * Math.sin(Math.PI * phaseMoon);
    ctx.globalAlpha = 1;
    ctx.fillStyle   = '#eee';
    ctx.beginPath();
    ctx.arc(arcX, arcY, moonR, 0, 2*Math.PI);
    ctx.fill();
  }

  // 4) stars fade in/out by wN
  //    wN = 0 at tC=0 & 1 (day), peaks at tC=0.5 (midnight)
  const starAlpha = Math.max(0, wN) * 0.8;
  if (starAlpha > 0) {
    ctx.globalAlpha = starAlpha;
    ctx.fillStyle   = '#fff';
    stars.forEach(s => ctx.fillRect(s.x, s.y, 2, 2));
  }
  // restore
  ctx.globalAlpha = 1;

}
    // ── Bird object ──
    const bird = {
      x:80, y:H/2, vel:0, rad:32, gravity:0.25, lift:5,
      flashTimer:0,
      stunTimer:0,
      shakeTimer:0,
      penguinShootTimer:0,
      draw(){
        if(shieldCount>0){
          ctx.save(); ctx.strokeStyle='silver'; ctx.lineWidth=3;
          for(let i=0;i<8;i++){
            const ang=(Math.PI*2/8)*i,
                  x1=this.x+(this.rad+2)*Math.cos(ang),
                  y1=this.y+(this.rad+2)*Math.sin(ang),
                  x2=this.x+(this.rad+8)*Math.cos(ang),
                  y2=this.y+(this.rad+8)*Math.sin(ang);
            ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
          }
          ctx.restore();
        }
                // — coin halo around bird whenever you have coins —
        if (coinCount > 0) {
          ctx.save();
          for (let i = 0; i < coinCount; i++) {
            const angle = frames * 0.05 + (2 * Math.PI / 10) * i;
            const cx = this.x + (this.rad + 12) * Math.cos(angle);
            const cy = this.y + (this.rad + 12) * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'yellow';
            ctx.fill();
          }
          ctx.restore();
        }
        if(superTimer>0){
          ctx.save(); ctx.strokeStyle='yellow'; ctx.lineWidth=8; ctx.globalAlpha=0.6;
          ctx.beginPath(); ctx.arc(this.x,this.y,this.rad+8,0,2*Math.PI); ctx.stroke();
          ctx.restore();
        }
        // draw bird sprite
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.shakeTimer > 0) {
          ctx.translate((Math.random()-0.5)*4, (Math.random()-0.5)*4);
          this.shakeTimer--;
        }
        ctx.rotate(Math.min(Math.PI/4, this.vel/10));
        if (this.flashTimer > 0 && Math.floor(this.flashTimer/2)%2===0) {
          ctx.filter = 'brightness(2)';
        }
        let img = birdSprite;
        if (defaultSkin === 'birdieV2.png' && birdSprite.src.includes('birdieV2.png')) {
          img = DEFAULT_BIRD_FRAMES[Math.floor(frames / 6) % DEFAULT_BIRD_FRAMES.length];
        } else if (defaultSkin === 'cow_down.png' && !birdSprite.src.includes('cow_mech')) {
          img = this.vel < 0 ? cowUpSprite : cowDownSprite;
        } else if (isBatSkin() && !birdSprite.src.includes('mech_bat')) {
          img = this.vel < 0 ? BAT_FLY : BAT_FRAMES[Math.floor(frames / 6) % BAT_FRAMES.length];
        } else if (defaultSkin === 'penguin1.png') {
          if (birdSprite.src.includes('penguinmecha')) {
            if (this.penguinShootTimer > 4) img = penguinMechaShoot1;
            else if (this.penguinShootTimer > 0) img = penguinMechaShoot2;
            else img = penguinMechaBase;
          } else {
            img = PENGUIN_FRAMES[Math.floor(frames / 6) % PENGUIN_FRAMES.length];
          }
        }
        const iw = 64;
        const ih = 64;
        ctx.drawImage(img, -iw/2, -ih/2, iw, ih);
        ctx.restore();
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.penguinShootTimer > 0) this.penguinShootTimer--;
      },
      flap(){
        if (this.stunTimer > 0) {
          this.shakeTimer = 10;
          return;
        }
        this.vel=-this.lift;
        playTone(300,0.08);
        if (defaultSkin === 'FireSkinBase.png' || defaultSkin === 'AquaSkinBase.png' || defaultSkin === 'story_bird.png') {
          const type = defaultSkin === 'FireSkinBase.png' ? 'fire'
                      : defaultSkin === 'AquaSkinBase.png' ? 'bubble' : 'page';
          const life = type === 'page' ? 80 : 20;
          for (let i = 0; i < 6; i++) {
            const p = {
              x: this.x - 20,
              y: this.y,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              size: 4 + Math.random() * 3,
              life,
              max: life,
              type,
              shape: ['circle', 'triangle', 'square'][Math.floor(Math.random() * 3)]
            };
            if (type === 'page') {
              p.rot  = Math.random() * Math.PI * 2;
              p.vrot = (Math.random() - 0.5) * 0.05;
            }
            skinParticles.push(p);
            if (type === 'fire' && Math.random() < 0.5) {
              skinParticles.push({
                x: this.x - 20,
                y: this.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: 4 + Math.random() * 4,
                life: 25,
                max: 25,
                type: 'smoke'
              });
            }
          }
        }
        if (defaultSkin === 'MoneySkin.png') {
          const cnt = 4 + Math.floor(Math.random()*4);
          for(let i=0;i<cnt;i++) {
            spawnMoneyLeaf(this.x, this.y, (Math.random()-0.5)*0.5, 1+Math.random());
          }
        }
        if (defaultSkin === 'penguin1.png') {
          for (let i = 0; i < 6; i++) {
            snowflakes.push({
              x: this.x - 20,
              y: this.y,
              vx: (Math.random()-0.5)*2,
              vy: (Math.random()-0.5)*2 + 1,
              rot: Math.random()*Math.PI*2,
              vrot:(Math.random()-0.5)*0.1,
              size:8+Math.random()*4,
              life:40
            });
          }
          if (inMecha) this.penguinShootTimer = 6;
        }
      },
      update(){
        if(state===STATE.Start) this.y = H/2 + 10*Math.sin(frames/10);
        else {
          if (revivePromptActive) {
            return;
          }
          if (reviveTimer > 0) {
            this.vel = 0;
            this.y += (H/2 - this.y) * 0.1;
          } else {
            if (this.stunTimer > 0) {
              this.stunTimer--;
              this.vel = 0;
              if (frames % 5 === 0) {
                electricRings.push({ x:this.x, y:this.y, r:20,
                  alpha:0.6,
                  color: Math.random()<0.5?'cyan':'magenta' });
              }
            } else {
              this.vel += this.gravity * (heavyLoadActive ? 1.5 : 1);
            }
            this.y += this.vel;
            if (isBatSkin() && !inMecha) {
              batThrust.push({
                x: this.x - 10,
                y: this.y + 25,
                vx: (Math.random()-0.5)*0.5,
                vy: 2 + Math.random()*0.5,
                life: 15,
                rot: this.vel < 0 ? Math.PI/2 : 5 * Math.PI / 4
              });
            }
          }
          if (defaultSkin === 'FireSkinBase.png' || defaultSkin === 'AquaSkinBase.png') {
            const type = defaultSkin === 'FireSkinBase.png' ? 'fire' : 'bubble';
            for (let i=0;i<2;i++) {
              skinParticles.push({
                x:this.x-20,
                y:this.y,
                vx:(Math.random()-0.5)*2,
                vy:(Math.random()-0.5)*2,
                size:3+Math.random()*3,
                life:20,
                max:20,
                type,
                shape:['circle','triangle','square'][Math.floor(Math.random()*3)]
              });
              if (type === 'fire' && Math.random() < 0.4) {
                skinParticles.push({
                  x:this.x-20,
                  y:this.y,
                  vx:(Math.random()-0.5)*3,
                  vy:(Math.random()-0.5)*3,
                  size:3+Math.random()*4,
                  life:25,
                  max:25,
                  type:'smoke'
                });
              }
            }
          }
          if (defaultSkin === 'penguin1.png' && frames % 3 === 0) {
            snowflakes.push({
              x:this.x-20,
              y:this.y,
              vx:(Math.random()-0.5)*1,
              vy:Math.random()*1+0.5,
              rot:Math.random()*Math.PI*2,
              vrot:(Math.random()-0.5)*0.05,
              size:6+Math.random()*3,
              life:40
            });
          }
          if (this.y + this.rad > H) {
            if ((state === STATE.Play || state === STATE.Boss) && !revivePromptActive) {
              endGame();
            }
          }

          if(this.y-this.rad<0){ this.y=this.rad; this.vel=0; }
        }
      },
      reset(){ this.y=H/2; this.vel=0; }
    };

    // ── Pipes & pickups ──
function spawnPipe(){
  pipeCount++;
  const decay = Math.pow(0.9, Math.floor(pipeCount/10)),
        appP  = baseAppleProb /* * decay*/,
        rocketP = baseTripleProb;
  let coinP = (baseCoinProb + coinSpawnBonus) * (marathonMode ? 0.25 : 1);
  if (defaultSkin === 'MoneySkin.png') coinP *= 1.2;

  // pick a random gap in the top half
  const topH = 50 + Math.random()*(H/2),
        gap  = Math.max(minGap, initialGap - Math.floor(pipeCount/15)*10),
        color= pipeColors[Math.floor(pipeCount/20)%pipeColors.length];

  if (marathonMode && gap === minGap) marathonMoving = true;

  // push the new pipe
  const movingChance = (bossesDefeated >= 2 || marathonMoving)
    ? movingPipeChanceActive
    : movingPipeChanceBase;
  const moving = (bossesDefeated >= 2 || marathonMoving) && Math.random() < movingChance;
  if (moving) coinP *= 0.5;
  let p = null;
  if (!gauntletMode) {
    pipes.push({
      x: W,
      top: topH,
      baseTop: topH,
      gap,
      color,
      passed: false,
      moving,
      phase: Math.random() * Math.PI * 2,
      amp: pipeMoveAmplitude
    });
    p = pipes[pipes.length - 1];
  }
  if (p) {
    if (isFireSkin()) {
      // keep normal pipes for the Fire skin
    } else if (isAquaSkin()) {
      p.img = iceColumnImg;
      p.snowFX = true;
    // keep normal pipes for the Story skin
    } else if (isStorySkin()) {
      // no custom column image
    } else if (defaultSkin === 'cow_down.png' || birdSprite.src.includes('cow_mech')) {
      p.img = cowPipeImg;
    }
  }



  // — apples —
  if (Math.random() < appP) {
    const ax = W + pipeW/2;
    const ay = topH + gap*0.5 + (Math.random()*gap*0.5 - gap*0.25);
    apples.push({ x: ax, y: ay, taken: false });
  }

  // — coins —
  if (Math.random() < coinP) {
    const cx = W + pipeW/2;
    const cy = topH + gap*0.4 + Math.random()*gap*0.2;
    // avoid stacking coins on apples or other coins
    const collidesApple = apples.some(a => Math.hypot(a.x - cx, a.y - cy) < appleR + coinR);
    const collidesCoin  = coins .some(c => Math.hypot(c.x - cx, c.y - cy) < coinR*2);
    if (!collidesApple && !collidesCoin) {
      coins.push({ x: cx, y: cy, taken: false });
    }
  }

  // — triple rocket powerup — (only spawn once the Mecha suit is active)
  if (inMecha && Math.random() < rocketP) {
    const rx = W + pipeW/2;
    const ry = topH + gap*0.5 + (Math.random()*gap*0.4 - gap*0.2);
    rocketPowerups.push({
      x: rx,
      y: ry,
      taken: false
    });
  }
}

function spawnFirePipe(){
  spawnPipe();
  const p = pipes[pipes.length-1];
  p.color = '#FF5722';
  p.fireGlow = true;
}

function spawnJelly(){
  jellies.push({
    x: W + 40,
    baseY: Math.random() * (H - 100) + 50,
    amp: 30 + Math.random()*20,
    freq: 0.04 + Math.random()*0.02,
    vx: -1.5,
    frame: 0,
    hp: 6,
    shockTimer: 0,
    shockInterval: 180,
    shockDuration: 40,
    isShocking: false,
    flashTimer: 0,
    pushX: 0,
    pushY: 0,
    burnTimer: 0,
    slowStacks: 0,
  freezeTimer: 0
  });
}

function spawnRocketWave(){
  const rCount = bossesDefeated >= 2 ? 2 : 3;
  for (let i = 0; i < rCount; i++) {
    rocketsIn.push({
      x: W + 20 + i * 60,
      y: Math.random() * (H - 100) + 50,
      vx: -3
    });
    rocketsSpawned++;
  }
}

function spawnSliceDisk(){
  slicingDisks.push({
    x: W + 40,
    y: Math.random() * (H - 80) + 40,
    vx: -2,
    vy: 0,
    rot: 0,
    hp: 3,
    enemy: true
  });
}

function spawnCheeseKiller() {
  const spawnY = Math.random() * (H - 100) + 50;
  cheeseKiller = {
    x: W + 40,
    y: spawnY,
    vx: -1.5,
    vy: 0,
    r: 32,
    hp: CHEESE_KILLER_MAX_HP,
    max: CHEESE_KILLER_MAX_HP,
    charge: 0,
    cooldown: 0,
    flashTimer: 0
  };
  showCheeseMessage();
  triggerShake(10);
}

function spawnExplosion(x, y, fromRocket = false, electric = false) {
  explosions.push({ x, y, frame: 0 });
  explosionSfx.currentTime = 0;
  explosionSfx.play().catch(() => {});
  if (fromRocket && rocketSplash && state !== STATE.Boss) {
    for(let a=0;a<8;a++){
      const ang = a * Math.PI/4;
      slicingDisks.push({ x, y, vx: Math.cos(ang)*3, vy: Math.sin(ang)*3, rot:0, hp:1, enemy:false });
    }
    for(let s=0;s<10;s++){
      rocketParticles.push({x,y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:20,type:Math.floor(Math.random()*3)});
    }
  }
  if (electric) {
    triggerShake(8);
    electricRings.push({ x, y, r: 20, alpha: 0.8, color: 'cyan' });
    electricRings.push({ x, y, r: 20, alpha: 0.8, color: 'magenta' });
    spawnElectricLines(x, y);
    for(let jj=jellies.length-1;jj>=0;jj--){
      const j=jellies[jj];
      if(Math.hypot(j.x-x,j.y-y)<40){
        spawnImpactParticles(j.x, j.y, j.x - x, j.y - y);
        const mag=Math.hypot(j.x - x, j.y - y)||1;
        j.pushX += (j.x - x)/mag * 6;
        j.pushY += (j.y - y)/mag * 6;
        j.flashTimer = 6;
        j.hp = (j.hp||1) - 1;
        if(j.hp<=0){
          jellies.splice(jj,1);
          maybeDropShock(j.x,j.y);
          runJellies++;
          if(runJellies>=5) unlockAchievement('kill5');
          if(runJellies>=10) triggerStoryEvent('Jelly_Vanquished');
        }
      }
    }
  }
  if (isStorySkin() && Math.random() < 0.05) {
    const type = Math.random() < 0.5 ? 'fire' : 'ice';
    rocketSymbols.push({ x, y, type, taken:false });
  }
}

function updateExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    const img = e.frame < 5 ? explosionImgs[0] : explosionImgs[1];
    const size = e.frame < 5 ? 32 : 48;
    ctx.drawImage(img, e.x - size / 2, e.y - size / 2, size, size);
    e.frame++;
    if (e.frame > 10) explosions.splice(i, 1);
  }
}

function spawnImpactParticles(x, y, dx, dy) {
  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag; dy /= mag;
  for (let i = 0; i < 5; i++) {
    impactParticles.push({
      x,
      y,
      vx: dx * (1 + Math.random()*0.5) * 3 + (Math.random()-0.5),
      vy: dy * (1 + Math.random()*0.5) * 3 + (Math.random()-0.5),
      life: 15
    });
  }
}

function updateImpactParticles() {
  for (let i = impactParticles.length - 1; i >= 0; i--) {
    const p = impactParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.life--;
    ctx.save();
    ctx.fillStyle = 'orange';
    ctx.globalAlpha = p.life / 15;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if (p.life <= 0) impactParticles.splice(i,1);
  }
}

function spawnStaggerSpark(x, y) {
  staggerSparks.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    life: 20
  });
}

function updateStaggerSparks() {
  for (let i = staggerSparks.length - 1; i >= 0; i--) {
    const s = staggerSparks[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.95;
    s.vy *= 0.95;
    s.life--;
    ctx.save();
    ctx.globalAlpha = s.life / 20;
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if (s.life <= 0) staggerSparks.splice(i,1);
  }
}

function spawnMilkSplash(x, y) {
  for (let i = 0; i < 8; i++) {
    milkParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 20,
      size: 2 + Math.random() * 3
    });
  }
}

function updateMilkParticles() {
  for (let i = milkParticles.length - 1; i >= 0; i--) {
    const m = milkParticles[i];
    m.x += m.vx;
    m.y += m.vy;
    m.vy += 0.1;
    m.life--;
    ctx.save();
    ctx.globalAlpha = m.life / 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if (m.life <= 0) milkParticles.splice(i,1);
  }
}

function spawnElectricLines(x, y){
  for(let b=0;b<3;b++){
    const pts=[];
    const len=40+Math.random()*20;
    let px=x, py=y, ang=Math.random()*Math.PI*2;
    for(let s=0;s<5;s++){
      ang += (Math.random()-0.5)*0.5;
      px += Math.cos(ang)*len/5;
      py += Math.sin(ang)*len/5;
      pts.push({x:px,y:py});
    }
    electricBolts.push({x, y, pts, life:60, color:Math.random()<0.5?'cyan':'magenta'});
  }
}

function updateElectricBolts(){
  for(let i=electricBolts.length-1;i>=0;i--){
    const b=electricBolts[i];
    b.life--;
    const alpha=Math.sin((b.life/60)*Math.PI);
    ctx.save();
    const col=b.color==='cyan'?'0,255,255':'255,0,255';
    ctx.strokeStyle=`rgba(${col},${alpha})`;
    ctx.lineWidth=2+2*alpha;
    ctx.beginPath();
    ctx.moveTo(b.x,b.y);
    b.pts.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.stroke();
    ctx.restore();
    if(b.life<=0) electricBolts.splice(i,1);
  }
}

function updateSkinParticles() {
  for (let i = skinParticles.length - 1; i >= 0; i--) {
    const p = skinParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === 'page') {
      if (p.floatPhase === undefined) p.floatPhase = Math.random() * Math.PI * 2;
      p.floatPhase += 0.05;
      p.x += Math.sin(p.floatPhase) * 0.3;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.vy += 0.05;
      if (p.rot === undefined) p.rot = Math.random() * Math.PI * 2;
      if (p.vrot === undefined) p.vrot = (Math.random() - 0.5) * 0.05;
      p.rot += p.vrot;
    } else {
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    p.life--;
    ctx.save();
    ctx.globalAlpha = p.type === 'page' ? 1 : (p.life / p.max) * 0.7;
    if (p.type === 'page') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size);
      ctx.lineTo(p.size, -p.size);
      ctx.quadraticCurveTo(p.size * 1.2, 0, p.size, p.size);
      ctx.lineTo(-p.size, p.size);
      ctx.quadraticCurveTo(-p.size * 1.2, 0, -p.size, -p.size);
      ctx.fill();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      if (!p.lines) {
        p.lines = [];
        const n = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < n; j++) {
          p.lines.push({
            y: -p.size * 0.6 + j * p.size * 0.6,
            o: (Math.random() - 0.5) * p.size * 0.3
          });
        }
      }
      for (const l of p.lines) {
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.7, l.y);
        ctx.lineTo(p.size * 0.7, l.y + l.o);
        ctx.stroke();
      }
    } else if (p.type === 'fire') {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, 'rgba(255,255,0,0.5)');
      g.addColorStop(0.5, 'rgba(255,120,0,0.3)');
      g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      if (p.shape === 'triangle') {
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x + p.size, p.y + p.size);
        ctx.lineTo(p.x - p.size, p.y + p.size);
        ctx.closePath();
      } else if (p.shape === 'square') {
        ctx.rect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    } else if (p.type === 'smoke' || p.type === 'darkSmoke') {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.5);
      if (p.type === 'darkSmoke') {
        g.addColorStop(0, 'rgba(0,0,0,0.3)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        g.addColorStop(0, 'rgba(80,60,40,0.2)');
        g.addColorStop(1, 'rgba(80,60,40,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (p.floatPhase === undefined) p.floatPhase = Math.random() * Math.PI * 2;
      p.floatPhase += 0.05;
      p.vy -= 0.02; // gentle float up
      p.x += Math.sin(p.floatPhase) * 0.3;
      ctx.fillStyle = 'rgba(150,220,255,0.3)';
      ctx.strokeStyle = 'rgba(150,220,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    if ((p.type === 'page' && (p.y > H + 40 || p.x < -40 || p.x > W + 40)) || p.life <= 0) {
      skinParticles.splice(i, 1);
    }
  }
}

function updateSnowflakes() {
  for (let i = snowflakes.length - 1; i >= 0; i--) {
    const f = snowflakes[i];
    f.x += f.vx;
    f.y += f.vy;
    f.vy += 0.02;
    f.rot += f.vrot;
    f.life--;
    ctx.save();
    ctx.globalAlpha = f.life / 40;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.drawImage(snowflakeImg, -f.size/2, -f.size/2, f.size, f.size);
    ctx.restore();
    if (f.life <= 0 || f.y > H + 40) snowflakes.splice(i,1);
  }
}

function updateBatThrust(){
  for(let i=batThrust.length-1;i>=0;i--){
    const t = batThrust[i];
    t.x += t.vx;
    t.y += t.vy;
    t.life--;
    ctx.save();
    ctx.globalAlpha = (t.life/15) * 0.6;
    ctx.fillStyle = 'cyan';
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot || Math.PI/2);
    const size = 3;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if(t.life<=0) batThrust.splice(i,1);
  }
}

function spawnBatSwarms(x, y){
  const count = 2 + Math.floor(Math.random()*4);
  for(let i=0;i<count;i++){
    batSwarms.push({
      x,
      y,
      vx:(Math.random()-0.5)*2,
      vy:(Math.random()-0.5)*2,
      state:'roam',
      timer:60,
      parts:[]
    });
  }
}

function updateBatSwarms(){
  for(let i=batSwarms.length-1;i>=0;i--){
    const s = batSwarms[i];
    if(s.state==='roam'){
      s.vx += (Math.random()-0.5)*0.2;
      s.vy += (Math.random()-0.5)*0.2;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.98;
      s.vy *= 0.98;
      s.timer--;
      if(s.timer<=0){
        let target=null;
        if(jellies.length) target=jellies[Math.floor(Math.random()*jellies.length)];
        else if(stage2Bombs.length) target=stage2Bombs[Math.floor(Math.random()*stage2Bombs.length)];
        else if(bossActive && bossObj) target=bossObj;
        if(target){
          s.tx=target.x; s.ty=target.y; s.state='seek'; s.timer=30;
        } else {
          batSwarms.splice(i,1);
          continue;
        }
      }
    } else if(s.state==='seek'){
      const dx=s.tx - s.x;
      const dy=s.ty - s.y;
      const dist=Math.hypot(dx,dy)||1;
      s.vx+=dx/dist*0.5;
      s.vy+=dy/dist*0.5;
      s.x+=s.vx+(Math.random()-0.5);
      s.y+=s.vy+(Math.random()-0.5);
      s.vx*=0.95; s.vy*=0.95;
      if(dist<6){ s.state='strike'; s.timer=10; }
    } else if(s.state==='strike'){
      s.x += (Math.random()-0.5)*2;
      s.y += (Math.random()-0.5)*2;
      s.timer--;
      if(s.timer<=0){
        spawnExplosion(s.x, s.y);
        batSwarms.splice(i,1);
        continue;
      }
    }
    s.parts.push({x:s.x, y:s.y, life:20});
    for(let j=s.parts.length-1;j>=0;j--){
      const p=s.parts[j];
      p.life--;
      ctx.save();
      ctx.globalAlpha=p.life/20;
      ctx.fillStyle='black';
      ctx.translate(p.x,p.y);
      ctx.rotate(Math.PI/2);
      const size=3;
      ctx.beginPath();
      ctx.moveTo(0,-size);
      ctx.lineTo(size,size);
      ctx.lineTo(-size,size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if(p.life<=0) s.parts.splice(j,1);
    }
  }
}

function updateSonarRings(){
  for(let i=sonarRings.length-1;i>=0;i--){
    const r = sonarRings[i];
    r.r += 3;
    r.alpha -= 0.02;
    ctx.save();
    ctx.strokeStyle = `rgba(0,150,255,${r.alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = `rgba(0,150,255,${r.alpha})`;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
    if(r.alpha<=0) sonarRings.splice(i,1);
  }
}

function updatePulseRings(){
  for(let i=pulseRings.length-1;i>=0;i--){
    const r = pulseRings[i];
    r.r += 2;
    r.alpha -= 0.03;
    ctx.save();
    const col = r.color === 'yellow' ? '255,230,0' : '0,150,255';
    ctx.strokeStyle = `rgba(${col},${r.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
    if(r.alpha<=0) pulseRings.splice(i,1);
  }
}

function spawnMoneyLeaf(x, y, vx, vy) {
  const img = leafImages[Math.floor(Math.random() * leafImages.length)];
  moneyLeaves.push({
    x, y, vx, vy,
    rot: Math.random() * Math.PI * 2,
    vrot:(Math.random()-0.5)*0.1,
    size:12+Math.random()*6,
    life:60+Math.random()*20,
    img
  });
}

function maybeDropCoin(x, y){
  if (isStorySkin() && Math.random() < 0.15) {
    coins.push({ x, y, taken:false });
  }
}

function maybeDropShock(x, y){
  if(Math.random() < 0.5){
    shockDrops.push({ x, y, frame:0, taken:false });
  }
}

function updateMoneyLeaves(){
  for(let i=moneyLeaves.length-1;i>=0;i--){
    const l = moneyLeaves[i];
    l.x  += l.vx;
    l.y  += l.vy;
    l.vy += 0.05;
    l.vx *= 0.99;
    l.rot+= l.vrot;
    l.life--;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.drawImage(l.img, -l.size/2, -l.size/2, l.size, l.size);
    ctx.restore();
    if(l.life<=0 || l.y>H+40) moneyLeaves.splice(i,1);
  }
}

function updateColumnFlames(){
  for(let i=columnFlames.length-1;i>=0;i--){
    const f = columnFlames[i];
    f.life--;
    ctx.save();
    ctx.globalAlpha = f.life / 15;
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.arc(f.x + (Math.random()-0.5)*6, f.y + (Math.random()-0.5)*20, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if(f.life<=0) columnFlames.splice(i,1);
  }
}

function updateColumnSnow(){
  for(let i=columnSnow.length-1;i>=0;i--){
    const s = columnSnow[i];
    s.life--;
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.02;
    ctx.save();
    ctx.globalAlpha = s.life / 20;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if(s.life<=0) columnSnow.splice(i,1);
  }
}

function updateReviveEffect() {
  if (reviveTimer <= 0) return;
  if (frames % 15 === 0) {
    reviveRings.push({ r: bird.rad, alpha: 0.7 });
  }
  for (let i = reviveRings.length - 1; i >= 0; i--) {
    const ring = reviveRings[i];
    ring.r += 3;
    ring.alpha -= 0.02;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${ring.alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (ring.alpha <= 0) reviveRings.splice(i, 1);
  }
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(reviveTimer/60), W/2, H/2);
  ctx.restore();
}

  function updateDoubleEffect() {
    if (!doubleActive) return;
  if (frames % 15 === 0 || (doublePulse > 0 && frames % 5 === 0)) {
    doubleRings.push({ r: bird.rad, alpha: 0.4 });
  }
  for (let i = doubleRings.length - 1; i >= 0; i--) {
    const ring = doubleRings[i];
    ring.r += 2;
    ring.alpha -= 0.015;
    ctx.save();
    ctx.strokeStyle = `rgba(255,223,0,${ring.alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,223,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (ring.alpha <= 0) doubleRings.splice(i, 1);
  }
    if (doublePulse > 0) doublePulse--;
  }

  function spawnMagnetParticle(x, y){
    magnetParticles.push({x, y, life:10});
  }

  function updateMagnetEffect(){
    if(!magnetActive) return;
    for(let i=magnetParticles.length-1;i>=0;i--){
      const p = magnetParticles[i];
      p.life--;
      ctx.save();
      ctx.globalAlpha = p.life/10;
      ctx.fillStyle = '#0ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      if(p.life<=0) magnetParticles.splice(i,1);
    }
  }

  function updateElectricEffect(){
    if(electricTimer<=0) return;
    if(frames % 6 === 0){
      electricRings.push({
        x: bird.x,
        y: bird.y,
        r: bird.rad,
        alpha: 0.6,
        color: Math.random() < 0.5 ? 'cyan' : 'magenta'
      });
    }
    for(let i=electricRings.length-1;i>=0;i--){
      const r = electricRings[i];
      r.r += 3;
      r.alpha -= 0.03;
      ctx.save();
      const c = r.color==='cyan'? '0,255,255' : '255,0,255';
      ctx.strokeStyle = `rgba(${c},${r.alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
      if(r.alpha<=0) electricRings.splice(i,1);
    }
    electricTimer--;
    if(electricTimer<=0) tripleElectric = false;
    if(discModeTimer>0) discModeTimer--;
  }

  function updateHeavyBall(){
    if(!heavyLoadActive) return;
    const dx=bird.x-heavyBall.x, dy=bird.y-heavyBall.y;
    const dist=Math.hypot(dx,dy)||1;
    const len=40;
    heavyBall.vx+= (dx/dist)*(dist-len)*0.1;
    heavyBall.vy+= (dy/dist)*(dist-len)*0.1 + 0.3;
    heavyBall.vx*=0.98;
    heavyBall.vy*=0.98;
    heavyBall.x+=heavyBall.vx;
    heavyBall.y+=heavyBall.vy;
    ctx.save();
    ctx.strokeStyle='#666';
    ctx.beginPath();
    ctx.moveTo(bird.x,bird.y);
    ctx.lineTo(heavyBall.x,heavyBall.y);
    ctx.stroke();
    ctx.drawImage(ballImg, heavyBall.x-16, heavyBall.y-16,32,32);
    ctx.restore();
  }

  function updateSmell(){
    if(!scareJellyActive) return;
    smellParticles.push({x:bird.x,y:bird.y,life:30});
    for(let i=smellParticles.length-1;i>=0;i--){
      const p=smellParticles[i];
      p.life--;
      p.x+=(Math.random()-0.5)*1;
      p.y+=(Math.random()-0.5)*1;
      ctx.save();
      ctx.globalAlpha=p.life/30;
      ctx.fillStyle='green';
      ctx.beginPath();
      ctx.arc(p.x,p.y,4,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
      if(p.life<=0) smellParticles.splice(i,1);
    }
  }

  function updatePipeClouds(){
    for(let i=pipeClouds.length-1;i>=0;i--){
      const c = pipeClouds[i];
      c.x -= c.speed;
      if(c.x < -32){
        c.x = W + 32 + Math.random()*800;
        c.y = 50 + Math.random()*150;
        c.speed = 3 + Math.random()*2;
      }
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(cloudOverlay, c.x - 16, c.y, 32, 32);
      ctx.restore();
    }
  }

    function drawPipes(){
      pipes.forEach(p=>{
        const img = p.img;
        if (img) {
          ctx.drawImage(img, p.x, 0, pipeW, p.top);
          ctx.save();
          ctx.translate(p.x, p.top + p.gap);
          ctx.scale(1, -1);
          ctx.drawImage(img, 0, -(H - p.top - p.gap), pipeW, H - p.top - p.gap);
          ctx.restore();
        } else {
          ctx.save();
          ctx.shadowColor   = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur    = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          const lighter = shade(p.color,40);
          const darker  = shade(p.color,-40);
          let grad = ctx.createLinearGradient(0,0,0,p.top);
          grad.addColorStop(0, lighter);
          grad.addColorStop(1, darker);

          ctx.fillStyle = p.fireGlow ? '#FF5722' : grad;
          ctx.fillRect(p.x, 0, pipeW, p.top);
          grad = ctx.createLinearGradient(0,0,0,H - p.top - p.gap);
          grad.addColorStop(0, lighter);
          grad.addColorStop(1, darker);
          ctx.fillStyle = p.fireGlow ? '#FF5722' : grad;
          ctx.fillRect(p.x, p.top + p.gap, pipeW, H - p.top - p.gap);
          ctx.lineWidth   = 3;
          ctx.strokeStyle = shade(p.color,-60);
          ctx.strokeRect(p.x, 0, pipeW, p.top);
          ctx.strokeRect(p.x, p.top + p.gap, pipeW, H - p.top - p.gap);
          ctx.restore();

        }
        if (!img && p.fireGlow) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,80,0,0.6)';
          ctx.shadowColor = 'rgba(255,80,0,0.8)';
          ctx.shadowBlur = 15;
          ctx.fillRect(p.x-2, p.top-8, pipeW+4, 8);
          ctx.fillRect(p.x-2, p.top+p.gap, pipeW+4, 8);
          ctx.restore();
        } else if (!img) {
          ctx.fillStyle = shade(p.color,-20);
          ctx.fillRect(p.x-2, p.top-8, pipeW+4, 8);
          ctx.fillRect(p.x-2, p.top+p.gap, pipeW+4, 8);
        }

        if (p.fireFX && frames % 5 === 0) {
          columnFlames.push({x:p.x + pipeW/2, y:p.top + p.gap/2, life:15});
        }
        if (p.snowFX && frames % 10 === 0) {
          columnSnow.push({x:p.x + Math.random()*pipeW, y:p.top + Math.random()*p.gap, vx:(Math.random()-0.5)*0.3, vy:0, life:20});
        }
      });
    }
function updateRockets() {
  // only run rockets logic during Mecha or Boss fight
  if (!(inMecha || state === STATE.Boss)) return;
  const ts = slowMoTimer > 0 ? 0.5 : 1;

  // ── OUTGOING ROCKETS ────────────────────────────────
  rocketsOut.forEach((r, i) => {
    // advance & draw the outgoing rocket
    r.x += r.vx * ts;
    if (r.erratic) {
      r.vy += (Math.random() - 0.5) * 0.3;
      if (bossActive && bossObj) {
        const dx = bossObj.x - r.x;
        if (dx < 80) {
          r.vy += r.y < bossObj.y ? -0.5 : 0.5;
          r.vx = Math.min(r.vx, 2);
        }
      }
    }
    r.y += (r.vy || 0) * ts;
    const size = r.size || (r.triple ? 20 : 16);
    const img = r.bat
               ? BAT_ROCKET_FRAMES[Math.floor(frames/4)%BAT_ROCKET_FRAMES.length]
               : r.type === 'fire' ? fireRocketSprite
               : r.type === 'ice' ? iceRocketSprite
               : r.type === 'cow' ? cowRocketSprite
               : r.type === 'penguin' ? penguinRocketSprite
               : rocketOutSprite;
    if (r.erratic) {
      ctx.save();
      ctx.translate(r.x + size/2, r.y);
      ctx.rotate(Math.atan2(r.vy || 0, r.vx));
      ctx.drawImage(img, -size/2, -size/2, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(img, r.x, r.y - size/2, size, size);
    }
    if (r.flame && frames % 2 === 0) {
      rocketFlames.push({x:r.x, y:r.y, life:10});
    }
    if (r.type === 'ice' && frames % 2 === 0) {
      rocketSnow.push({x:r.x, y:r.y, life:10, vx:(Math.random()-0.5)*0.5, vy:(Math.random()-0.5)*0.5});
    }
    if (r.type === 'penguin' && frames % 2 === 0) {
      snowflakes.push({x:r.x, y:r.y, vx:(Math.random()-0.5)*0.5, vy:(Math.random()-0.5)*0.5, rot:Math.random()*Math.PI*2, vrot:(Math.random()-0.5)*0.1, size:6, life:30});
    }
    if (r.triple && frames % 2 === 0) {
      rocketSmoke.push({ x:r.x, y:r.y, r:2, alpha:1 });
    }
    if (r.electric && frames % 4 === 0) {
      electricRings.push({
        x: r.x + size/2,
        y: r.y,
        r: 4,
        alpha: 0.5,
        color: Math.random() < 0.5 ? 'cyan' : 'magenta'
      });
    }
    if (r.money && frames % 3 === 0) {
      spawnMoneyLeaf(r.x, r.y, -1+(Math.random()-0.5)*0.5, 0.5+Math.random()*0.5);
    }

    // 1) check hits on stage-2 bombs
    for (let j = stage2Bombs.length - 1; j >= 0; j--) {
      const b = stage2Bombs[j];
      if (Math.hypot(r.x - b.x, r.y - b.y) < 18) {
        // consume the rocket
        rocketsOut.splice(i, 1);
        spawnExplosion(b.x, b.y, true, r.electric);
        if(r.bat && r.triple && r.electric) spawnBatSwarms(b.x, b.y);
        if (r.type === 'cow') spawnMilkSplash(b.x, b.y);
        maybeDropCoin(b.x, b.y);

        // bump bomb’s hit count
        b.hits = (b.hits || 0) + 1;
        if (b.hits === 1) {
          // first hit: glow
          b.homingActive = true;
        } else {
          // second hit: spawn homing rocket + remove bomb
          rocketsIn.push({ x: b.x, y: b.y, vx: 0, vy: 0, isHoming: true });
          stage2Bombs.splice(j, 1);
        }
        return;  // done with this rocket
      }
    }

    // 1b) damage jellies
    for (let jj = jellies.length - 1; jj >= 0; jj--) {
      const j = jellies[jj];
      if (Math.hypot(r.x - j.x, r.y - j.y) < 24) {
          rocketsOut.splice(i, 1);
          spawnExplosion(j.x, j.y, true, r.electric);
          if(r.bat && r.triple && r.electric) spawnBatSwarms(j.x, j.y);
        if (r.type === 'cow') spawnMilkSplash(j.x, j.y);
        maybeDropCoin(j.x, j.y);
        triggerShake(5);
        spawnImpactParticles(j.x, j.y, j.x - r.x, j.y - r.y);
        const mag = Math.hypot(j.x - r.x, j.y - r.y) || 1;
        j.pushX += (j.x - r.x) / mag * 6;
        j.pushY += (j.y - r.y) / mag * 6;
        j.flashTimer = 6;
        j.hp = (j.hp || 1) - 1;
        if (r.type === 'fire') j.burnTimer = 120;
        if (r.type === 'ice') j.slowStacks = Math.min(j.slowStacks + 1, 5);
        if (j.hp <= 0) {
          jellies.splice(jj, 1);
          maybeDropShock(j.x, j.y);
          runJellies++;
          if (runJellies >= 5) unlockAchievement('kill5');
          if (runJellies >= 10) triggerStoryEvent('Jelly_Vanquished');
        }
        return;
      }
    }

    // 2) existing rocket-vs-rocket collisions
    for (let k = rocketsIn.length - 1; k >= 0; k--) {
      const rin = rocketsIn[k];
      if (rin.isBossShot) continue;
      if (Math.hypot(r.x - rin.x, r.y - rin.y) < 24) {
        rocketsOut.splice(i, 1);
          rocketsIn.splice(k, 1);
          spawnExplosion(r.x, r.y, true, r.electric);
          if(r.bat && r.triple && r.electric) spawnBatSwarms(r.x, r.y);
        if (r.type === 'cow') spawnMilkSplash(r.x, r.y);
        maybeDropCoin(r.x, r.y);
        score++; updateScore();
        bossRocketCount++;
        if (!bossActive && !marathonMode && !bossTriggerActive &&
            bossRocketCount >= bossRocketThreshold) {
          rocketsIn.push({
            x: W + 40,
            y: Math.random() * (H - 100) + 50,
            vx: -1,
            isBossTrigger: true
          });
          bossRocketCount = 0;
          bossTriggerActive = true;
        }
        if (rin.isBossTrigger && !marathonMode) {
          startBossFight();
          bossTriggerActive = false;
          bossTriggerMisses = 0;
          bossRocketThreshold = 60;
          bossRocketCount = 0;
          return;
        }
        playTone(1000, 0.2);
        return;
      }
    }

    // 3) pipe collisions & off-screen
    pipes.forEach((p, pi) => {
      if (r.x > p.x && r.x < p.x+pipeW
          && r.y > p.top && r.y < p.top+p.gap) {
        if (p.disk) {
          const di = slicingDisks.indexOf(p.disk);
          if (di >= 0) slicingDisks.splice(di, 1);
        }
        pipes.splice(pi,1);
        rocketsOut.splice(i,1);
        if (r.type === 'cow') spawnMilkSplash(p.x + pipeW/2, p.top + p.gap/2);
        maybeDropCoin(p.x + pipeW/2, p.top + p.gap/2);
      }
    });
    if (r.x > W+20) rocketsOut.splice(i,1);
  });


// ── STAGE-2 SLOW BOMBS ───────────────────────────────
for (let i = stage2Bombs.length - 1; i >= 0; i--) {
  const b = stage2Bombs[i];
  const ts = slowMoTimer > 0 ? 0.5 : 1;

  // advance
  b.x += b.vx * ts;

  // pick the right sprite
  const img = b.homingActive ? activeHomingImg : bombSprite;

  // **use the game's logical sprite size (16×16), not img.width**
  const baseSize = 16;      // the size you were drawing before
  const scale    = 3;       // how much bigger you want it
  const drawSize = baseSize * scale;

  // draw it centered on b.x,b.y
  ctx.drawImage(
    img,
    b.x - drawSize / 2,
    b.y - drawSize / 2,
    drawSize,
    drawSize
  );

    // 3) **collision with bird?**
  const dist = Math.hypot(bird.x - b.x, bird.y - b.y);
  const bombRadius = drawSize/2;
  if (dist < bird.rad + bombRadius) {
    handleHit();
    stage2Bombs.splice(i, 1);
    continue;
  }

  // remove if off-screen
  if (b.x + drawSize/2 < 0) {
    stage2Bombs.splice(i, 1);
  }
}




  // ── INCOMING ROCKETS ─────────────────────────────────
  rocketsIn.forEach((r, i) => {
    // 0) special pulse rockets
    if (r.pulseRush) {
      if (frames % 6 === 0) {
        pulseRings.push({x:r.x,y:r.y,r:10,alpha:0.6,color:'blue'});
        pulseRings.push({x:r.x,y:r.y,r:10,alpha:0.6,color:'yellow'});
      }
      if (!r.rush && Math.hypot(bird.x - r.x, bird.y - r.y) < 120) {
        r.isHoming = true;
        r.homingStrength = 0.02;
        r.rush = true;
      }
    }

    // 1) homing-steer if flagged
    if (r.isHoming) {
      if (r.x < bird.x && !r.ignoreXCheck) {
        r.isHoming = false;
      } else {
        const dx = bird.x - r.x;
        const dy = bird.y - r.y;
        const accel = r.homingStrength || 0.001;
        r.vx += dx * accel;
        r.vy += dy * accel;
        if (!r.homingStrength) {
          r.vx *= 0.98;
          r.vy *= 0.98;
        }
      }
    }

    // 2) advance
    r.x += r.vx * ts;
    r.y += (r.vy || 0) * ts;
    if (r.electric && frames % 4 === 0) {
      electricRings.push({ x:r.x, y:r.y, r:r.big?8:4, alpha:0.5,
        color: Math.random()<0.5?'cyan':'magenta' });
    }

   // 3) draw incoming rocket, rotated when homing
   const rocketSize = r.big ? 96 : r.isBossTrigger ? 96 : r.isSlice ? 64 : 48;
   ctx.save();
   if (r.isHoming) {
     // point sprite along its velocity vector
     ctx.translate(r.x, r.y);
     const angle = Math.atan2(r.vy, r.vx);
     ctx.rotate(angle);
      ctx.scale(r.vx < 0 ? 1 : -1, 1);
    ctx.drawImage(
      r.isSlice ? sliceSprite : (r.shock ? shockRocketSprite : (r.architect ? fireRocketSprite : rocketInSprite)),
      -rocketSize/2,
      -rocketSize/2,
      rocketSize, rocketSize
    );
  } else if (r.isBossShot || r.isBossTrigger || r.isSlice) {
     // unchanged boss shot / trigger
     ctx.translate(r.x, r.y);
     ctx.scale(-1, 1);
     ctx.drawImage(
       r.isSlice ? sliceSprite : (r.shock ? shockRocketSprite : (r.architect ? fireRocketSprite : rocketInSprite)),
       -rocketSize/2, -rocketSize/2,
       rocketSize, rocketSize
     );
   } else {
  // ― Rotate so that the rocket sprite points along (vx,vy) ―
  const angle = Math.atan2(r.vy || 0, r.vx);
  ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(angle);
    ctx.drawImage(
      rocketInSprite,
      -rocketSize/2,
      -rocketSize/2,
      rocketSize,
      rocketSize
    );
  ctx.restore();
}
   ctx.restore();

    // 4) collision with bird
    if (Math.hypot(bird.x - r.x, bird.y - r.y) < 24) {
      if (!r.isBossTrigger) {
        tripleShot = false;
        tripleElectric = false;
        electricTimer = 0;
        const loss = r.coinLoss || 1;
        if (coinCount >= loss) {
          coinCount -= loss; updateScore(); playTone(1000, 0.2);
        } else {
          inMecha = false;
          mechaTriggered = false;
          mechSpeed = baseSpeed;
          birdSprite.src = 'assets/' + defaultSkin;
          mechaMusic.pause();
          bgMusic.currentTime = 0;
          bgMusic.play().catch(()=>{});
          explosionSfx.currentTime = 0;
          explosionSfx.play();
          flyingArmor.push({ img: armorPiece1, x: bird.x, y: bird.y, vx:-2, vy:-3 });
          flyingArmor.push({ img: armorPiece2, x: bird.x, y: bird.y, vx: 2, vy:-3 });
        }
        if (r.shock && Math.random() < (r.big ? 0.6 : 0.3)) {
          bird.stunTimer = 180;
        }
      } else {
        bossTriggerActive = false;
        bossTriggerMisses++;
        bossRocketThreshold = bossTriggerMisses >= 2 ? 5 : 10;
      }
      rocketsIn.splice(i, 1);
      return;
    }

    // 5) off-screen cleanup
  if (r.x < -20) {
    if (r.isBossTrigger) {
      bossTriggerActive = false;
      bossTriggerMisses++;
      bossRocketThreshold = bossTriggerMisses >= 2 ? 5 : 10;
    }
    rocketsIn.splice(i, 1);
  }
  });

  // draw and fade smoke for triple rockets
  rocketSmoke.forEach((s, si) => {
    s.r += 0.2;
    s.alpha -= 0.05;
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = 'grey';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if (s.alpha <= 0) rocketSmoke.splice(si, 1);
  });

  rocketFlames.forEach((f, fi) => {
    f.life--;
    ctx.save();
    ctx.globalAlpha = f.life / 10;
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if (f.life <= 0) rocketFlames.splice(fi, 1);
  });

  rocketSnow.forEach((s, si) => {
    s.life--;
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.02;
    ctx.save();
    ctx.globalAlpha = s.life / 10;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    if (s.life <= 0) rocketSnow.splice(si, 1);
  });

  updateExplosions();
  updateImpactParticles();
  updateStaggerSparks();
  updateMilkParticles();
  updateElectricBolts();
}

function updateJellies() {
  if (!inMecha || bossActive) return;
  for (let i = jellies.length - 1; i >= 0; i--) {
    const j = jellies[i];
    if (scareJellyActive && Math.hypot(bird.x - j.x, bird.y - j.y) < 80) {
      j.vx = Math.abs(j.vx);
    }
    const ts = slowMoTimer > 0 ? 0.5 : 1;
    const speedFactor = j.freezeTimer > 0 ? 0 : 1 - j.slowStacks * 0.1;
    if (j.freezeTimer > 0) j.freezeTimer--;
    else j.frame++;
    j.x += j.vx * ts * speedFactor;
    if (j.pushX) { j.x += j.pushX; j.pushX *= 0.8; }
    j.y = j.baseY + Math.sin(j.frame * j.freq) * j.amp + (j.pushY || 0);
    if (j.pushY) j.pushY *= 0.8;

    // shock cycle
    j.shockTimer++;
    if (!j.isShocking && j.shockTimer > j.shockInterval) {
      j.isShocking = true;
      j.shockTimer = 0;
    } else if (j.isShocking && j.shockTimer > j.shockDuration) {
      j.isShocking = false;
      j.shockTimer = 0;
    }

    // draw jelly
    const framesArr = j.isShocking ? jellyShockFrames : jellyFrames;
    const img = framesArr[Math.floor(j.frame / 8) % framesArr.length];
    ctx.save();
    if (j.flashTimer > 0 && Math.floor(j.flashTimer/2)%2===0) {
      ctx.filter = 'brightness(2)';
    }
    ctx.drawImage(img, j.x - 32, j.y - 32, 64, 64);
    if (j.slowStacks > 0 || j.freezeTimer > 0) {
      ctx.globalAlpha = 0.3 + 0.1 * j.slowStacks;
      ctx.fillStyle = 'rgba(100,180,255,0.5)';
      ctx.beginPath();
      ctx.arc(j.x, j.y, 32, 0, Math.PI*2);
      ctx.fill();
    }
    if (j.burnTimer > 0) {
      ctx.globalAlpha = j.burnTimer / 120 * 0.5;
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      ctx.arc(j.x, j.y, 32, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
    if (j.flashTimer > 0) j.flashTimer--;

    if (j.isShocking) {
      const shockImg = jellyShockFrames[Math.floor(j.frame / 4) % jellyShockFrames.length];
      for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI/2 + j.frame * 0.1;
        ctx.drawImage(shockImg, j.x + Math.cos(ang)*40 - 16, j.y + Math.sin(ang)*40 - 16, 32, 32);
      }
    }

    const rad = j.isShocking ? 40 : 24;
    if (Math.hypot(bird.x - j.x, bird.y - j.y) < bird.rad + rad) {
      handleHit();
      jellies.splice(i,1);
      continue;
    }

    if (j.burnTimer > 0) {
      j.burnTimer--;
      if (frames % 30 === 0) j.hp--;
      if (j.hp <= 0) { maybeDropShock(j.x,j.y); jellies.splice(i,1); continue; }
    }
    if (j.slowStacks === 5 && j.freezeTimer === 0 && Math.random() < 0.02) {
      j.freezeTimer = 60;
      j.slowStacks = 0;
    }

    if (j.x < -60) jellies.splice(i,1);
  }
}

function updateSliceDisks() {
  for (let i = slicingDisks.length - 1; i >= 0; i--) {
    const d = slicingDisks[i];
    if (d.pipe) {
      d.x = d.pipe.x + pipeW / 2;
      d.y += d.vy;
      if (d.y < d.pipe.top + 24 || d.y > d.pipe.top + d.pipe.gap - 24) {
        d.vy *= -1;
      }
    } else {
      d.x += d.vx;
      d.y += d.vy || 0;
    }
    d.rot += 0.2;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.drawImage(slicingDiskSprite, -24, -24, 48, 48);
    if(d.pulse && frames%4===0){
      electricRings.push({x:d.x,y:d.y,r:10,alpha:0.5,color:'cyan'});
      electricRings.push({x:d.x,y:d.y,r:10,alpha:0.5,color:'magenta'});
    }
    ctx.restore();
    if(d.enemy){
      if (Math.hypot(bird.x - d.x, bird.y - d.y) < bird.rad + 24) {
        handleHit();
        d.hp = 0;
      }
      for(let j=rocketsOut.length-1;j>=0;j--){
        const r=rocketsOut[j];
        if(Math.hypot(r.x-d.x,r.y-d.y)<24){
          rocketsOut.splice(j,1);
          d.hp--;
          spawnExplosion(d.x,d.y);
          break;
        }
      }
    } else {
      for(let jj=jellies.length-1;jj>=0;jj--){
        const j=jellies[jj];
        if(Math.hypot(d.x-j.x,d.y-j.y)<24){
        spawnExplosion(j.x,j.y);
        j.hp=(j.hp||1)-(d.damage||1);
          j.flashTimer=6;
          if(j.hp<=0){ jellies.splice(jj,1); maybeDropShock(j.x,j.y); runJellies++; if(runJellies>=5) unlockAchievement('kill5'); }
          d.hp=0;
          break;
        }
      }
      for(let k=rocketsIn.length-1;k>=0;k--){
        const rin=rocketsIn[k];
        if(rin.isBossShot) continue;
        if(Math.hypot(d.x-rin.x,d.y-rin.y)<24){
          rocketsIn.splice(k,1);
          spawnExplosion(d.x,d.y);
          score++; updateScore();
          d.hp=0;
          break;
        }
      }
    }
    if (d.hp!==undefined && d.hp<=0) { slicingDisks.splice(i,1); continue; }
    if (d.x < -60 || d.x>W+60 || d.y<-60 || d.y>H+60) slicingDisks.splice(i,1);
  }
}

function updateCheeseKiller() {
  if (!cheeseKiller) return;
  const ck = cheeseKiller;
  const ts = slowMoTimer > 0 ? 0.5 : 1;
  const targetX = W - 80;
  if (ck.x > targetX) {
    ck.x += ck.vx * ts;
    if (ck.x < targetX) ck.x = targetX;
  } else {
    ck.x = targetX;
  }
  ck.vy += (bird.y - ck.y) * 0.02 * ts;
  ck.vy += Math.sin(frames * 0.05) * 0.1 * ts;
  ck.y += ck.vy * ts;
  ck.vy *= 0.95;
  ck.y = Math.max(ck.r, Math.min(H - ck.r, ck.y));
  if (ck.cooldown > 0) ck.cooldown--;
  if (ck.charge > 0) {
    ck.charge--;
    if (ck.charge == 0) {
      rocketsIn.push({ x: ck.x - ck.r, y: ck.y, vx: -4, vy: 0, isHoming: true });
      ck.cooldown = 40;
    }
  } else if (ck.cooldown <= 0 && Math.random() < 0.05) {
    ck.charge = 20;
    triggerShake(5);
  }
  const img = ck.charge > 0 ? cheeseChargeSprite : cheeseKillerSprite;
  ctx.drawImage(img, ck.x - 32, ck.y - 32, 64, 64);
  const barW = 60;
  ctx.fillStyle = '#444';
  ctx.fillRect(ck.x - barW/2, ck.y - ck.r - 10, barW, 4);
  ctx.fillStyle = 'lime';
  ctx.fillRect(ck.x - barW/2, ck.y - ck.r - 10, barW * (ck.hp / ck.max), 4);
  if (ck.flashTimer > 0) ck.flashTimer--;
  for (let i = rocketsOut.length - 1; i >= 0; i--) {
    const r = rocketsOut[i];
    if (Math.hypot(r.x - ck.x, r.y - ck.y) < ck.r + 8) {
      rocketsOut.splice(i,1);
      spawnExplosion(ck.x, ck.y, false, r.electric);
      ck.hp -= (r.damage || 10);
      ck.flashTimer = 6;
      if (ck.hp <= 0) {
        cheeseKiller = null;
        startBossFight();
        break;
      }
    }
  }
  if (Math.hypot(bird.x - ck.x, bird.y - ck.y) < ck.r + bird.rad) {
    handleHit();
  }
}

  function updatePipes(){
  // only run during play or boss
  if (state !== STATE.Play && state !== STATE.Boss) return;

  const ts = slowMoTimer > 0 ? 0.5 : 1;

  // — handle coin boosts & dynamic speed (unchanged) —
  coinBoostExpiries = coinBoostExpiries.filter(exp => exp > frames);
  const activeBoosts = coinBoostExpiries.length;
  const targetSpeed = baseSpeed * Math.pow(1.3, activeBoosts) + pipeCount/200;
  currentSpeed += (targetSpeed - currentSpeed) * 0.05;

  // spawn new pipes only in normal modes
  if (state === STATE.Play && frames % 90 === 0 && !inMecha && !gauntletMode) spawnPipe();

  // ── pipe movement, scoring & collision ──
  pipes.forEach((p,i) => {
    // move pipe horizontally
    p.x -= currentSpeed * ts;

    // optional vertical oscillation
    if (p.moving) {
      p.top = p.baseTop + Math.sin(frames * pipeMoveSpeed + p.phase) * p.amp;
    }

    // score for passing through
    if (!p.passed && p.x + pipeW < bird.x) {
      p.passed = true;
      score++;
      updateScore();
      playTone(600, 0.08);
      runPipes++;
      if (runPipes >= 20) {
        unlockAchievement('pass20');
        triggerStoryEvent('Pipe_Threshold_Reached');
      }
    }

    // ←— NEW COLLISION / SHIELD LOGIC:
    if (
      bird.x + bird.rad > p.x &&
      bird.x - bird.rad < p.x + pipeW &&
      (bird.y - bird.rad < p.top || bird.y + bird.rad > p.top + p.gap)
    ) {
      let broke = false;
      if (superTimer > 0) {
        // you’re “super” (apple), break pipe as before
        if (p.disk) {
          const di = slicingDisks.indexOf(p.disk);
          if (di >= 0) slicingDisks.splice(di, 1);
        }
        pipes.splice(i, 1);
        score++;
        updateScore();
        playTone(900, 0.2);
        broke = true;
      } else {
        if (coinCount > 0) broke = true;
        handleHit();
        // remove the pipe so you don’t get stuck
        if (p.disk) {
          const di = slicingDisks.indexOf(p.disk);
          if (di >= 0) slicingDisks.splice(di, 1);
        }
        pipes.splice(i, 1);
      }
      if (broke) {
        runPipeBreaks++;
        if (runPipeBreaks >= 15) triggerStoryEvent('Pipe_Beyond_Obstacles');
        if (runPipeBreaks >= 20) {
          unlockAchievement('break20');
          triggerStoryEvent('Pipe_Breaker');
        }
      }
    }

    // cleanup off-screen
    if (p.x + pipeW < 0) {
      if (p.disk) {
        const di = slicingDisks.indexOf(p.disk);
        if (di >= 0) slicingDisks.splice(di, 1);
      }
      pipes.splice(i, 1);
    }
  });

  // ── apple pickup (unchanged) ──
  apples.forEach((a,i)=>{
    a.x -= currentSpeed * ts;
    if(!a.taken){
      ctx.fillStyle='red'; ctx.beginPath(); ctx.arc(a.x,a.y,appleR,0,2*Math.PI); ctx.fill();
      ctx.fillStyle='green'; ctx.beginPath();
      ctx.ellipse(a.x+6,a.y-appleR/2,4,8,Math.PI/4,0,2*Math.PI); ctx.fill();
      if(Math.hypot(bird.x-a.x,bird.y-a.y)<bird.rad+appleR){
        a.taken=true; superTimer=300; playTone(1200,0.2);
      }
    }
    if(a.x+appleR<0||a.taken) apples.splice(i,1);
  });

  // ── coin pickup (your existing code) ──
  coins.forEach((c, i) => {
  // move
    const coinSpeed = inMecha ? baseSpeed * 0.66 : currentSpeed;
    if(c.homing){
      const dx = bird.x - c.x;
      const dy = bird.y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      c.x += (dx/dist) * 4;
      c.y += (dy/dist) * 4;
    } else {
      c.x -= coinSpeed * ts;
    }

    if (!c.taken) {
      const batAttract = isBatSkin();
      if(magnetActive || batAttract){
        const dx = bird.x - c.x;
        const dy = bird.y - c.y;
        const dist = Math.hypot(dx, dy);
        const range = Math.max(magnetActive ? 80 : 0, batAttract ? 120 : 0);
        if(dist < range){
          c.x += dx * 0.1;
          c.y += dy * 0.1;
          if(frames % 4 === 0) spawnMagnetParticle(c.x, c.y);
          if(batAttract && frames % 6 === 0){
            sonarRings.push({ x: bird.x, y: bird.y, r: 10, alpha: 0.8 });
          }
        }
      }
      // draw spinning coin…
    ctx.save();
    ctx.translate(c.x, c.y);
    const angle = frames * 0.1;
    for (let j = 0; j < 8; j++) {
      const radOff = 6;
      const xOff = Math.cos((j * 2 * Math.PI) / 8 + angle) * radOff;
      const yOff = Math.sin((j * 2 * Math.PI) / 8 + angle) * radOff;
      ctx.beginPath();
      ctx.arc(xOff, yOff, 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'gold';
      ctx.fill();
    }
    ctx.restore();

    // collect
    if (Math.hypot(bird.x - c.x, bird.y - c.y) < bird.rad + coinR) {
      c.taken = true;
      const gain = doubleActive ? 2 : 1;
      coinCount += gain;
      totalCoins += gain;
      if (doubleActive) doublePulse = 60;
      localStorage.setItem('birdyCoinsEarned', totalCoins);
      if (totalCoins >= 100) triggerStoryEvent('Coin_Threshold');
      if (totalCoins >= 500) unlockAchievement('coins500');
      playTone(1000, 0.1);//playChord('V', audioCtx.currentTime);
      updateScore();
      updateCoins();
      runCoins++;
      if (runCoins >= 10) unlockAchievement('coin10');
      if (runCoins >= 50) triggerStoryEvent('Coin_Offering');

      // ←— trigger Mecha when you hit 10 coins (Adventure only)
      if (coinCount >= 10 && !mechaTriggered && !marathonMode) {
        mechaTriggered = true;
        state = STATE.MechaTransit;
        startMechaTransition();
      }
    }
  }

  // cleanup
  if (c.x + coinR < 0 || c.taken) coins.splice(i, 1);
});

  // ── shock drop pickup ──
  shockDrops.forEach((p,i)=>{
    const spd = baseSpeed * 0.6 * (inMecha ? 0.66 : 1);
    p.x -= spd * ts;
    p.frame++;
    if(!p.taken){
      const img = jellyFrames[Math.floor(p.frame/8)%jellyFrames.length];
      const shockImg = jellyShockFrames[Math.floor(p.frame/4)%jellyShockFrames.length];
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(frames*0.1)*2);
      ctx.drawImage(img, -8, -8, 16, 16);
      for(let a=0;a<4;a++){
        const ang=a*Math.PI/2+frames*0.1;
        ctx.drawImage(shockImg, Math.cos(ang)*20-8, Math.sin(ang)*20-8,16,16);
      }
      ctx.restore();
      ctx.save();
      ctx.textAlign='center';
      ctx.fillStyle='#fff';
      ctx.font='12px sans-serif';
      ctx.fillText('Shock', p.x, p.y-18);
      ctx.restore();
      ctx.strokeStyle='rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,12,0,Math.PI*2);
      ctx.stroke();
      if(Math.hypot(bird.x-p.x,bird.y-p.y)<bird.rad+12){
        p.taken=true;
        tripleElectric=true;
        electricTimer=300;
        addEffectIcon('shock','assets/jelly1.png');
      }
    }
    if(p.x< -20 || p.taken) shockDrops.splice(i,1);
  });

  // ── triple rocket powerup pickup ──
  rocketPowerups.forEach((p,i)=>{
    const powerSpeed = baseSpeed * 0.6 * (inMecha ? 0.66 : 1);
    if(p.homing){
      const dx = bird.x - p.x;
      const dy = bird.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      p.x += (dx/dist) * 4;
      p.y += (dy/dist) * 4;
    } else {
      p.x -= powerSpeed * ts;
    }
    if(!p.taken){
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(frames*0.1)*2);
      const img = isBatSkin() ? BAT_ROCKET_FRAMES[0]
               : (defaultSkin === 'cow_down.png' || birdSprite.src.includes('cow_mech')) ? cowRocketSprite : rocketOutSprite;
      for(let j=0;j<3;j++){
        ctx.drawImage(img, -8, -12 + j*8, 16, 16);
      }
      ctx.restore();
      ctx.save();
      ctx.textAlign='center';
      ctx.fillStyle='#fff';
      ctx.font='12px sans-serif';
      ctx.fillText(tripleShot ? 'Pulse' : 'Triple', p.x, p.y-18);
      ctx.restore();

      if(frames % 4 === 0){
        for(let n=0;n<2;n++){
          rocketParticles.push({
            x:p.x,
            y:p.y,
            vx:(Math.random()-0.5)*0.5,
            vy:(Math.random()-0.5)*0.5,
            life:20,
            type:Math.floor(Math.random()*3)
          });
        }
      }

      if(Math.hypot(bird.x - p.x, bird.y - p.y) < bird.rad + rocketPowerR){
        p.taken = true;
        if(tripleShot){
          tripleElectric = true;
          electricTimer = 540;
          if(rocketPulseUpgrade && electricTimer>0) discModeTimer = 300;
        } else {
          tripleShot = true;
        }
        runPowerups++;
        unlockAchievement('rocket3');
        if (runPowerups >= 5) triggerStoryEvent('Rocket_Rite');
      }
    }
    if(p.x + rocketPowerR < 0 || p.taken) rocketPowerups.splice(i,1);
  });

  // ── story rocket symbol pickup ──
  rocketSymbols.forEach((s,i)=>{
    const spd = baseSpeed * 0.6 * (inMecha ? 0.66 : 1);
    s.x -= spd * ts;
    if(!s.taken){
      const img = s.type === 'fire' ? fireRocketSprite : iceRocketSprite;
      ctx.drawImage(img, s.x - 8, s.y - 8, 16, 16);
      if(Math.hypot(bird.x - s.x, bird.y - s.y) < bird.rad + rocketSymbolR){
        s.taken = true;
        specialRocket = s.type;
        playTone(1200,0.1);
      }
    }
    if(s.x + rocketSymbolR < 0 || s.taken) rocketSymbols.splice(i,1);
  });

  // update & draw rocket powerup particles
  rocketParticles.forEach((pa, idx) => {
    pa.x += pa.vx;
    pa.y += pa.vy;
    pa.life--;
    ctx.save();
    ctx.globalAlpha = pa.life / 20;
    ctx.fillStyle = 'cyan';
    ctx.translate(pa.x, pa.y);
    const size = 3 + (20 - pa.life) * 0.1;
    switch(pa.type){
      case 0:
        ctx.beginPath();
        ctx.arc(0,0,size,0,Math.PI*2);
        ctx.fill();
        break;
      case 1:
        ctx.fillRect(-size,-size,size*2,size*2);
        break;
      case 2:
        ctx.beginPath();
        ctx.moveTo(0,-size);
        ctx.lineTo(size, size);
        ctx.lineTo(-size, size);
        ctx.closePath();
        ctx.fill();
        break;
    }
    ctx.restore();
    if(pa.life<=0) rocketParticles.splice(idx,1);
  });
}


    // ── Score, Game Over, High Scores ──
function updateScore(){
  let txt = score;
  if (coinCount   > 0) txt += ` 🟡×${coinCount}`;
  scoreEl.textContent = txt;

  if (score >= 100) unlockAchievement('score100');
  if (score >= 500) unlockAchievement('score500');
  if (marathonMode && score >= 100) unlockAchievement("mar100");
  if (marathonMode && score >= 250) unlockAchievement("mar250");
  if (marathonMode && score >= 500) unlockAchievement("mar500");
}

function updateReviveDisplay(){
  document.getElementById("reviveCount").textContent = `${storedRevives}/1`;
}
function updateAdventureInfo(){
  const el = document.getElementById("adventureCount");
  if(el) el.textContent = adventurePlays + "/" + ADVENTURE_MAX;
}
function updateAdventureTimer(){
  regenAdventurePlays();
  const el = document.getElementById("adventureTimer");
  if(!el) return;
  if(adventurePlays >= ADVENTURE_MAX){
    el.textContent = "";
    return;
  }
  const now = Date.now();
  let diff = adventureStamp + ADVENTURE_RECHARGE - now;
  if(diff < 0) diff = 0;
  const m = Math.floor(diff/60000);
  const s = Math.floor((diff%60000)/1000);
  el.textContent = `Next in ${m}:${String(s).padStart(2,"0")}`;
}

function addEffectIcon(key, src){
  const ed=document.getElementById('effectDisplay');
  if(document.getElementById('effect-'+key)) return;
  const img=document.createElement('img');
  img.id='effect-'+key;
  img.src=src;
  ed.appendChild(img);
}
function removeEffectIcon(key){
  const img=document.getElementById('effect-'+key);
  if(img) img.remove();
}
function clearEffectIcons(){
  document.getElementById('effectDisplay').innerHTML='';
}

function updateUpgradeStats(){
  const el = document.getElementById("upgradeStats");

  if(!el) return;
  const rate = ((baseCoinProb + coinSpawnBonus) * 100).toFixed(0);
  let html = `Coin Rate: ${rate}%`;
  const rocketNames = [];
  upgradeTreeConfig.forEach(b=>{
    b.upgrades.forEach(u=>{
      if(equippedUpgrades.includes(u.id) && u.id.includes('rocket')){
        rocketNames.push(u.name);
      }
    });
  });
  if(equippedUpgrades.includes('mech_rocket_pulse')){
    rocketNames.push('Pulse Rockets');
  }
  if(rocketNames.length){
    html += `<div>Rocket Upgrades: ${rocketNames.join(', ')}</div>`;
  }
  if(magnetActive){
    html += `<div>Magnetism On</div>`;
  }
  html += `<div>Slots: ${equippedUpgrades.length}/${equipSlots}</div>`;
  el.innerHTML = html;
  el.style.textAlign = 'center';
}

function startReviveEffect(){
  usedRevive = true;
  reviveTimer = 180;         // 3 second countdown
  reviveRings.length = 0;
  bird.vel = 0;
  bird.y = H/2;              // bring player back to mid-screen
  coinCount += 5;
  updateScore();
  updateReviveDisplay();
  triggerStoryEvent('Revive_Used');
  for(let i=0;i<20;i++){
    skinParticles.push({
      x: bird.x,
      y: bird.y,
      vx:(Math.random()-0.5)*4,
      vy:(Math.random()-0.5)*4,
      size:4+Math.random()*3,
      life:30,
      max:30,
      type:'bubble'
    });
  }
}

function hideSpinOverlay(){
  const ov = document.getElementById('spinOverlay');
  ov.style.display = 'none';
  if (typeof casinoTheme !== 'undefined') {
    casinoTheme.pause();
    casinoTheme.currentTime = 0;
  }
  spinOverlayClickable = false;
}

let revivePromptActive = false;

function finalizeGameOver(){
  trackEvent('game_over', { score });
  trackEvent('score_recorded', { name: lastPlayerName || 'Anon', score });
  state = STATE.Over;
  hasSubmittedScore  = false;
  overlayTop10Lock   = false;
  cheeseKiller = null;
  topStayTimer = 0;

  if (score > personalBest) {
    personalBest = score;
    localStorage.setItem('birdyBestScore', personalBest);
    document.getElementById('bestScore').textContent = personalBest;
  }

  playTone(100, 0.3);
  showOverlay();
  if (gauntletMode) resetGame();
}

const GOOD_PROB = 0.5,
      BAD_PROB = 0.2,
      NOTHING_PROB = 0.3;

const ROLLS = 20,
      ROW_H  = 40,
      DURS   = [2000,3500,5000];

const FIRST9 = [
  'Revive.png','Double.png','Magnet.png',
  'rocket1.png','1.png','5.png','10.png','50.png',
  'birdieV2.png'
];
const LOSE_MAP = {
  'pipe_move.png':'Pipes Move',
  'ball.png':'Heavy Load',
  'stinky.png':'Scare Jelly'
};
const SYMBOLS = [...FIRST9, ...Object.keys(LOSE_MAP)];
const GOOD_LABELS = { 'birdieV2.png':'Daily Play' };

const WIN_HEIGHT = 100,
      PRIZE_TARGET_Y = WIN_HEIGHT/2 - ROW_H/2;

function updateCoins(){
  coinDisplay.textContent = totalCoins;
  if (spinCoinDisplay) {
    spinCoinDisplay.textContent = `Birds: ${adventurePlays}/${ADVENTURE_MAX}`;
  }
}
function doShake(){
  spinOverlay.classList.add('shake');
  setTimeout(()=>spinOverlay.classList.remove('shake'), 500);
}

let ticking = false;
function tickScale(){
  reels.forEach(reel => {
    const rect = reel.getBoundingClientRect();
    const midY = rect.top + rect.height/2;
    reel.querySelectorAll('.symbol').forEach(img => {
      const r    = img.getBoundingClientRect();
      const ic   = r.top + r.height/2;
      const d    = Math.abs(ic - midY);
      const maxD = rect.height/2 + r.height;
      const s    = 1 + Math.max(0,1 - (d/maxD)) * 0.5;
      img.style.transform = `scale(${s})`;
    });
  });
  if(ticking) requestAnimationFrame(tickScale);
}

function chooseOutcome(){
  const r = Math.random();
  if (r < GOOD_PROB){
    let sym;
    if (Math.random() < 0.25) {
      sym = 'Revive.png';
    } else {
      const others = FIRST9.filter(s => s !== 'Revive.png');
      sym = others[Math.floor(Math.random()*others.length)];
    }
    return { result: [sym,sym,sym], type: 'good' };
  }
  else if (r < GOOD_PROB + BAD_PROB){
    const bads = Object.keys(LOSE_MAP);
    const mid  = bads[Math.floor(Math.random()*bads.length)];
    let l, r2;
    do {
      l  = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
      r2 = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    } while(l===mid && r2===mid);
    return { result: [l, mid, r2], type: 'bad' };
  }
  else {
    let l = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)],
        m = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)],
        r2= SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    while(l===m && m===r2){
      m = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    }
    return { result: [l,m,r2], type: 'none' };
  }
}


function buildStrip(finalSym){
  const frag = document.createDocumentFragment();
  for(let i=0;i<ROLLS;i++){
    const img = document.createElement('img');
    img.src       = `assets/${SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]}`;
    img.className = 'symbol';
    frag.appendChild(img);
  }
  const prize = document.createElement('img');
  prize.src       = `assets/${finalSym}`;
  prize.className = 'symbol';
  frag.appendChild(prize);
  const extra = document.createElement('img');
  extra.src       = `assets/${SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]}`;
  extra.className = 'symbol';
  frag.appendChild(extra);
  return frag;
}

function blinkCenter(r){
  r.querySelectorAll('.symbol')[ROLLS].classList.add('blink');
}

function reloadRoulette(){
  nextSpin = chooseOutcome();
  reels.forEach((reel,i) => {
    const strip = reel.querySelector('.strip');
    strip.style.transition = 'none';
    strip.innerHTML = '';
    strip.appendChild(buildStrip(nextSpin.result[i]));
    strip.style.transform = `translateY(${ROW_H * 5}px)`;
  });
}

function showPowerUpSpin(returnToMenu=false, forRevive=false) {
  spinReturnToMenu=returnToMenu;
  spinForRevive=forRevive;
  const ov=document.getElementById("spinOverlay");
  ov.style.display="block";
  document.getElementById("prizeText").textContent="";
  if (spinCoinDisplay) {
    spinCoinDisplay.textContent = `Birds: ${adventurePlays}/${ADVENTURE_MAX}`;
  }
  spinOverlayClickable=false;
  reloadRoulette();

  document.getElementById("spin-btn").style.pointerEvents="auto";
}

function closeSpinOverlay() {
  document.getElementById("spinOverlay").style.display="none";
  casinoTheme.pause();
  casinoTheme.currentTime = 0;
  if(prevMusic) {
    prevMusic.play().catch(()=>{});
    prevMusic = null;
  }
  if(state===STATE.Over){
    showOverlay();
  } else if(spinReturnToMenu){
    menuEl.style.display="block";
    resetGame();
  }
  spinReturnToMenu=false;
  spinForRevive=false;
  spinOverlayClickable=false;

}

const reels = [];
document.querySelectorAll('#spinOverlay .reel').forEach(r => reels.push(r));

function startRoulette(){
  spinBtn.style.pointerEvents = 'none';

  if(!nextSpin) reloadRoulette();
  const { result, type } = nextSpin;
  document.getElementById('prizeText').textContent = '';
  adventurePlays--;
  localStorage.setItem('birdyAdventurePlays', adventurePlays);
  recordAdventureUse();
  updateAdventureInfo();
  updateCoins();
  updateScore();


  ticking = true;
  requestAnimationFrame(tickScale);

  const finalShift = -(ROW_H * ROLLS - PRIZE_TARGET_Y);

  reels.forEach((reel,i) => {
    const strip = reel.querySelector('.strip');
    strip.style.transition = 'none';
    const initShift = ROW_H * 5;
    strip.style.transform = `translateY(${initShift}px)`;
    void strip.offsetWidth;

    if(i===0){
      spinSound.currentTime = 0;
      spinSound.play();
    }

    strip.style.transition = `transform ${DURS[i]}ms cubic-bezier(.75,0,.25,1)`;
    strip.style.transform  = `translateY(${finalShift}px)`;

    setTimeout(()=>{
      explosionSound.volume       = 0.5 * globalVolume;
      explosionSound.playbackRate = 2;
      explosionSound.currentTime  = 0;
      explosionSound.play();
      doShake();

      if(i === reels.length - 1){
        ticking = false;
        reels.forEach(blinkCenter);

        if (type === 'bad') {
          loseSound.currentTime = 0;
          loseSound.play();
          document.getElementById('prizeText').textContent = `Oh No: ${LOSE_MAP[result[1]]}`;
          if(spinForRevive){
            finalizeGameOver();
            spinReturnToMenu = true;
            spinForRevive=false;
          }
        }
        else if (type === 'none') {
          document.getElementById('prizeText').textContent = `Nothing this spin…`;
          if(spinForRevive){
            finalizeGameOver();
            spinReturnToMenu = true;
            spinForRevive=false;
          }
        }
        else {
          winSound.currentTime = 0;
          winSound.play();
          const sym = result[1];
          const label = GOOD_LABELS[sym] || sym.replace('.png','');
          document.getElementById('prizeText').textContent = `You got ${label}!`;
          if(!(spinForRevive && sym === 'Revive.png')){
            handleReward(sym, label);
          }
          if(spinForRevive){
            if(sym === 'Revive.png'){
              startReviveEffect();
              hideSpinOverlay();
              menuEl.style.display = 'none';
              spinReturnToMenu = false;
            }else{
              finalizeGameOver();
              spinReturnToMenu = true;
            }
            spinForRevive=false;
          }
        }

        updateCoins();
        updateScore();
        spinOverlayClickable = true;
        nextSpin = null;
      }
    }, DURS[i]);
  });
}

function handleReward(sym,label){
  switch (sym) {
    case 'Revive.png':
      storedRevives = 1;
      localStorage.setItem('birdyRevives', storedRevives);
      updateReviveDisplay();
      break;
    case 'Double.png':
      storedDoubles = 1;
      localStorage.setItem('birdyDouble', storedDoubles);
      break;
    case 'Magnet.png':
      spinMagnet = 1;
      localStorage.setItem('spinMagnet', '1');
      addEffectIcon('magnet','assets/Magnet.png');
      break;
    case 'rocket1.png':
      spinTriple = 1;
      localStorage.setItem('spinTriple', '1');
      addEffectIcon('triple','assets/rocket1.png');
      break;
    case '1.png':
      totalCoins += 1; break;
    case '5.png':
      totalCoins += 5; break;
    case '10.png':
      totalCoins += 10; break;
    case '50.png':
      totalCoins += 50; break;
    case 'birdieV2.png':
      adventurePlays = Math.min(adventurePlays + 1, ADVENTURE_MAX);
      localStorage.setItem('birdyAdventurePlays', adventurePlays);
      updateAdventureInfo();
      break;
    case 'ball.png':
      spinHeavy = 1;
      localStorage.setItem('spinHeavy','1');
      addEffectIcon('heavy','assets/ball.png');
      break;
    case 'pipe_move.png':
      spinPipeMove = 1;
      localStorage.setItem('spinPipeMove','1');
      addEffectIcon('pipe','assets/pipe_move.png');
      break;
    case 'stinky.png':
      spinStinky = 1;
      localStorage.setItem('spinStinky','1');
      addEffectIcon('stinky','assets/stinky.png');
      break;
  }
  if(['1.png','5.png','10.png','50.png'].includes(sym)){
    localStorage.setItem('birdyCoinsEarned', totalCoins);
    updateCoins();
  }
}
function showConfetti(){
  const ov=document.getElementById("spinOverlay");
  for(let i=0;i<20;i++){
    const d=document.createElement("div");
    d.className="confetti";
    d.style.left=Math.random()*100+"%";
    d.style.background=`hsl(${Math.random()*360},80%,60%)`;
    d.style.animationDuration=0.8+Math.random()*0.7+"s";
    ov.appendChild(d);
    d.addEventListener("animationend",()=>d.remove());
  }
}

function showFireworks(){
  const ov=document.getElementById('spinOverlay');
  for(let i=0;i<20;i++){
    const d=document.createElement('div');
    d.className='firework';
    d.style.left=40+Math.random()*20+'%';
    d.style.top=30+Math.random()*40+'%';
    d.style.background=`hsl(${Math.random()*360},80%,60%)`;
    ov.appendChild(d);
    d.addEventListener('animationend',()=>d.remove());
  }
}



function showRevivePrompt(){
  if (revivePromptActive || usedRevive) return false;
  const useItem = storedRevives > 0;
  const canRevive = useItem || totalCoins >= 50;
  revivePromptActive = true;
  bird.vel = 0;
  let countdown = 10;
  const ov = document.getElementById('overlay');
  const ct = document.getElementById('gameOverContent');
  function render(){
    ct.innerHTML = `
      <h2>${useItem ? 'Use Revive?' : 'Continue for 50 coins?'}</h2>
      ${useItem ? '' : `<p>Coins: ${totalCoins}</p>`}
      <p id="reviveClock">${countdown}</p>
      <button id="revBtn" class="menu-btn primary" ${canRevive ? '' : 'disabled'}>Revive</button>
      <button id="menuBtn" class="menu-btn primary">Menu</button>
    `;
  }
  render();
  ov.style.display = 'block';
  const int = setInterval(()=>{
    countdown--;
    const clk = document.getElementById('reviveClock');
    if (clk) clk.textContent = countdown;
    if (countdown <= 0) cleanup('menu');
  },1000);
  function cleanup(action){
    clearInterval(int);
    ov.style.display = 'none';
    revivePromptActive = false;
    if(action === 'revive'){
      if(useItem){
        storedRevives--;
        localStorage.setItem('birdyRevives', storedRevives);
      } else {
        totalCoins -= 50;
        localStorage.setItem('birdyCoinsEarned', totalCoins);
        updateScore();
      }
      startReviveEffect();
    } else if(action === 'menu') {
      finalizeGameOver();
    } else {
      finalizeGameOver();
    }
    updateReviveDisplay();
  }
  ct.onclick = (e)=>{
    if(e.target.id==='revBtn')    cleanup('revive');
    if(e.target.id==='menuBtn')   cleanup('menu');
  };
  return true;
}

function handleHit(){
  if (revivePromptActive || reviveTimer > 0) return;
  if (bossActive) bossHitless = false;
  tripleShot = false;
  tripleElectric = false;
  electricTimer = 0;
  specialRocket = null;
  bird.flashTimer = 8;
  if (coinCount > 0) {
    coinCount--;
    updateScore();
    playTone(1000,0.2);
  } else {
    endGame();
  }
}
      // ── boss after +100 in Mecha ─────────────────────────
  if ( inMecha
      && !bossActive
      && state === STATE.Play
      && score - mechaStartScore >= 100
      && !marathonMode
  ) {
    startBossFight();
  }
       function endGame(){
    if (!usedRevive) {
      if (showRevivePrompt()) return;
    }
    finalizeGameOver();
  }

  function resetGame(){
  // ── reset all game state ──
  state = STATE.Start;
  score = 0;
  shieldCount = 0;
  runPipes = runCoins = runJellies = runPowerups = runPipeBreaks = 0;
  marathonMoving = false;
  gauntletMode = false;
  menuEl.style.display = 'block';

  // clear out any leftover bullets/rockets:
  rocketsOut.length = 0;
  rocketsIn.length  = 0;
  jellies.length    = 0;
  rocketSmoke.length = 0;
  rocketFlames.length = 0;
  rocketSnow.length = 0;
  columnFlames.length = 0;
  columnSnow.length = 0;
  rocketPowerups.length = 0;
  slicingDisks.length = 0;

  // reset coins _before_ updating the UI
  coinCount         = 0;
  coinBoostExpiries = [];

  coins.length = 0;          // if you have a coins array too

  // reset pipes & pickups
  pipes.length = 0;
  apples.length = 0;

  // speeds & counters
  currentSpeed = baseSpeed;
  pipeCount    = 0;
  frames       = 0;
  superTimer   = 0;
  speedFlashTimer = 0;

  // reposition bird
  bird.reset();

  cheeseKiller = null;
  topStayTimer = 0;

      // ←─ ADD THIS:
  bossEncounterCount = 0;
  bossesDefeated   = 0;

  // ── reset mech state ──
  mechaTriggered   = false;
  inMecha          = false;
  mechaStage       = 0;
  transitionTimer  = 0;
  // (optionally also reset mechaSafeExpiry:)
  mechaSafeExpiry  = 0;
  tripleShot       = false;
  tripleElectric   = false;
  electricTimer    = 0;
  electricRings.length = 0;
  birdSprite.src   = 'assets/' + defaultSkin;
  mechSpeed        = baseSpeed;

  // finally, update the on-screen score/coin display:
  updateScore();
  usedRevive = false;
  reviveTimer = 0;
  updateReviveDisplay();
  doubleActive = false;
  doubleRings.length = 0;
  doublePulse = 0;
  heavyLoadActive = false;
  pipeMoveActive = false;
  scareJellyActive = false;
  smellParticles.length = 0;
  clearEffectIcons();
}
   // ── 3) GAME OVER / LEADERBOARD ──────────────────────────────


// showOverlay: ask for name only if you made top-50
// ── 3) GAME OVER / LEADERBOARD ──────────────────────────────

// showOverlay: ALWAYS ask for a name, regardless of global standing
  async function showOverlay() {
    // cancel any leftover auto-hide from a boss-defeat popup
    clearTimeout(achievementHideTimer);
    // compute whether this score belongs in top-50
    const top = await fetchTopGlobalScores(marathonMode);
    const lowestTopScore = top.length < 50
      ? -Infinity
      : top[top.length - 1].score;
    overlayTop10Lock = score >= lowestTopScore;

    const ov = document.getElementById('overlay');
    const ct = document.getElementById('gameOverContent');
    ov.style.display = 'block';
    ct.innerHTML = `
      <h2>Game Over!</h2>
      <p>Your score: ${score}</p>
      <label>Enter your name:</label><br/>
      <input id="nameInput" type="text" maxlength="10" value="${lastPlayerName}" /><br/>
      <button id="saveBtn">Save Score</button>
    `;

    document.getElementById('saveBtn').onclick = async () => {
      const name = document.getElementById('nameInput').value.trim() || 'Anon';
      localStorage.setItem('birdyName', name);
      lastPlayerName = name;
      await saveGlobalScore(name, score, marathonMode);
      trackEvent('submit_score', { score });
      hasSubmittedScore = true;

      // refresh the board
      const newAdv = await fetchTopGlobalScores(false);
      const newMar = await fetchTopGlobalScores(true);
      showHighScores(newAdv, newMar);
    };
  }


// showHighScores: display list + Play Again button
function renderBoard(hs, prefix){
  let html = `<div id="${prefix}Box" style="height:200px;overflow:hidden;display:inline-block;">`+
             `<ol id="${prefix}List" style="text-align:left;margin:0;padding-left:20px;list-style:none;">`;
  hs.forEach((i, idx) => html += `<li>${idx + 1}. ${i.name} — ${i.score}</li>`);
  html += `</ol></div>`;
  return html;
}

function startAutoScroll(boxId){
  const box  = document.getElementById(boxId);
  const max  = box.scrollHeight - box.clientHeight;
  let dir    = 1;
  let pos    = 0;
  setTimeout(()=>{
    function step(){
      pos += dir * 0.3;
      if(pos >= max){ pos = max; dir = -1; }
      if(pos <= 0){ pos = 0; dir = 1; }
      box.scrollTop = pos;
      if(document.getElementById(boxId)) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, 2000);
}

function showHighScores(hsAdv, hsMar, autoScroll = false){
  const ct = document.getElementById('gameOverContent');
  let html = `<h2>Top 50 Adventure</h2>` +
             renderBoard(hsAdv, 'hs') +
             `<h2 style="margin-top:16px;">Top 50 Marathon</h2>` +
             renderBoard(hsMar, 'ms') +
             `<br/><button id="retryBtn">Play Again</button> <button id="scoreHome">Home</button>`;
  ct.innerHTML = html;
  document.getElementById('retryBtn').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    resetGame();
  };
  const homeBtn = document.getElementById('scoreHome');
  if (homeBtn) homeBtn.onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    menuEl.style.display = 'block';
  };

  if(autoScroll){
    startAutoScroll('hsBox');
    startAutoScroll('msBox');
  }
}
function showAchievement(message, duration = 2000) {
  clearTimeout(achievementHideTimer);
  trackEvent('achievement_unlocked', { achievement: message });
  const pop = document.getElementById('achievementPopup');
  pop.textContent = `Achievement Unlocked: ${message}`;
  pop.style.display = 'block';
  achievementHideTimer = setTimeout(() => {
    pop.style.display = 'none';
  }, duration);
}

function showStageScore(lines, duration = 3000) {
  const el = document.getElementById('stageScore');
  el.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, duration);
}

let storyHideTimer;
function showStoryMessage(text, duration = 3000) {
  clearTimeout(storyHideTimer);
  const pop = document.getElementById('storyPopup');
  pop.textContent = `📖 ${text}`;
  pop.style.display = 'block';
  storyHideTimer = setTimeout(() => { pop.style.display = 'none'; }, duration);
}

function showCheeseMessage(duration = 2000) {
  const el = document.getElementById('cheeseMessage');
  el.textContent = 'Cheese Killer SUMMONED';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, duration);
}

function triggerStoryEvent(id) {
  if (!storyLog[id]) {
    storyLog[id] = true;
    localStorage.setItem('storyLog', JSON.stringify(storyLog));
    const entry = storyEntries.find(e => e.id === id);
    if (entry) {
      showStoryMessage(entry.epithet);

    }
    trackEvent('story_event', { id });
    checkStoryAchievements();
  }
}

function unlockAchievement(id) {
  if (!achievements[id]) {
    achievements[id] = true;
    localStorage.setItem('achievements', JSON.stringify(achievements));
    const def = achievementDefs.find(a => a.id === id);
    if (def) showAchievement(def.desc);
  }
}

function nextAchievementDesc() {
  for (const def of achievementDefs) {
    if (!achievements[def.id]) return def.desc;
  }
  return '';
}

function showAchievementsList() {
  const ov = document.getElementById('overlay');
  const ct = document.getElementById('gameOverContent');
  let html = '<h2>Achievements</h2><ul style="list-style:none;padding:0">';
  achievementDefs.forEach(def => {
    const done = achievements[def.id];
    html += `<li>${done ? '✅' : '❌'} ${def.desc}</li>`;
  });
  html += '</ul><button id="achHome">Home</button>';
  ct.innerHTML = html;
  ov.style.display = 'block';
  document.getElementById('achHome').onclick = () => {
    ov.style.display = 'none';
    menuEl.style.display = 'block';
  };
}

function showStoryLog() {
  const ov = document.getElementById('overlay');
  const ct = document.getElementById('gameOverContent');
  let html = '<h2>Story Log</h2><div style="text-align:left">';
  let nextHint = '';
  for (const ent of storyEntries) {
    if (storyLog[ent.id]) {
      html += `<p>📖 <strong>${ent.epithet}</strong> <em>(${ent.req})</em></p>`;
      ent.log.forEach(line => {
        html += `<p style="margin-left:20px;">${line}</p>`;
      });
    } else if (!nextHint) {
      nextHint = ent.req;
    }
  }
  if (nextHint) {
    html += `<p id="nextStory" class="flash" style="font-style:italic;margin-top:10px;">Next: ${nextHint}</p>`;
  }

  html += '</div><button id="storyHome">Home</button>';
  ct.innerHTML = html;
  ov.style.display = 'block';
  document.getElementById('storyHome').onclick = () => {
    ov.style.display = 'none';
    menuEl.style.display = 'block';
  };
}

function showShop() {
  const ov = document.getElementById('overlay');
  const ct = document.getElementById('gameOverContent');
  let section = 'skins';

  function render() {
    let html = `<h2>Shop</h2>` +
               `<p id="coinCount">Coins: ${totalCoins}</p>` +
               `<div style="margin-bottom:10px;">`+
               `<button id="tabSkins" ${section==='skins'?'disabled':''}>Skins</button>`+
               `<button id="tabItems" ${section==='items'?'disabled':''}>Items</button>`+
               `<button id="tabUpgrades" ${section==='upgrades'?'disabled':''}>Upgrades</button>`+
               `</div>`+
               `<div style="display:flex;flex-direction:column;align-items:center;">`;

      const skins = [
        {key:'birdieV2.png', name:'Default', cost:0, owned:true},
        {key:'FireSkinBase.png', name:'Fire Skin', cost:100, owned:ownedSkins['FireSkinBase.png']},
        {key:'AquaSkinBase.png', name:'Aqua Skin', cost:100, owned:ownedSkins['AquaSkinBase.png']},
        {key:'story_bird.png', name:'Story Skin', cost:100, owned:ownedSkins['story_bird.png'], req:10},
        {key:'batty1-min.png', name:'Bat', cost:100, owned:ownedSkins['batty1-min.png']},
        {key:'penguin1.png', name:'Penguin', cost:100, owned:ownedSkins['penguin1.png']},
        {key:'MoneySkin.png', name:'Money Bags', cost:500, owned:ownedSkins['MoneySkin.png']},
        {key:'cow_down.png', name:'Cow', cost:420, owned:ownedSkins['cow_down.png']}
      ];

    const items = [
      {key:'Revive.png', name:'Revive', cost:25, owned:storedRevives>0, extra:'<small>Continue after death</small>'},
      {key:'Double.png', name:'Double Coins', cost:50, owned:storedDoubles>0, extra:''},

      {key:"birdieV2.png", name:"5 Birds", cost:50, owned:false, extra:"<small>Extra Adventure Plays</small>"},
    ];

    if(section==='skins'){
      skins.forEach(s => {
        html += `<div style="margin:6px;display:flex;align-items:center;">` +
                `<span class="iconWrap"><img src="assets/${s.key}" width="32" height="32" class="iconBounce"><span class="shadow"></span></span>` +
                `${s.name} `;
        if (s.owned || s.cost === 0) {
          if (defaultSkin === s.key) {
            html += `(Equipped)`;
          } else {
            html += `<button data-equip="${s.key}">Equip</button>`;
          }
        } else if (s.req && Object.keys(storyLog).length < s.req) {
          html += `<span>(Complete ${s.req} story logs)</span>`;
        } else {
          html += `<button data-buy="${s.key}">Buy - ${s.cost}</button>`;
        }
        html += `</div>`;
      });
    } else if(section==='items') {
      items.forEach(it => {
        html += `<div style="margin:6px;display:flex;align-items:center;">`+
                `<span class="iconWrap"><img src="assets/${it.key}" width="32" height="32" class="iconBounce"><span class="shadow"></span></span>`+
                `${it.name} ${it.extra||''} `;
        if(it.owned){
          html += `(Owned)`;
        } else {
          html += `<button data-itembuy="${it.key}">Buy - ${it.cost}</button>`;
        }
        html += `</div>`;
      });
    } else if(section==='upgrades') {
      html += `<div id="upgradeTreeWrap" style="margin-top:10px;width:100%;height:calc(100% - 60px);overflow-y:auto;position:relative;">`+
              `<div id="upgradeTree"></div>`+
              `</div>`;
    }

    html += `</div><button id="shopHome">Home</button>`;
    if(section==='upgrades') {
      html += `<div id="upgradeStats" style="margin-top:4px;text-align:center;font-size:14px;"></div>`;
    }
    ct.innerHTML = html;
      if(section==='upgrades') {
        renderUpgradeTree();
        updateUpgradeStats();
      }

    ct.querySelectorAll('#tabSkins').forEach(b=>b.onclick=()=>{section='skins';render();});
    ct.querySelectorAll('#tabItems').forEach(b=>b.onclick=()=>{section='items';render();});
    ct.querySelectorAll('#tabUpgrades').forEach(b=>b.onclick=()=>{section='upgrades';render();});

    ct.querySelectorAll('button[data-buy]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-buy');
        const skin = skins.find(s=>s.key===key);
        const cost = skin ? skin.cost : 100;
        if (totalCoins >= cost) {
          totalCoins -= cost;
          ownedSkins[key] = true;
          localStorage.setItem('birdyCoinsEarned', totalCoins);
          localStorage.setItem('birdyOwnedSkins', JSON.stringify(ownedSkins));
          defaultSkin = key;
          localStorage.setItem('birdySkin', defaultSkin);
          birdSprite.src = 'assets/' + defaultSkin;
          trackEvent('shop_skin_purchased', { skin: key });
          render();
        }
      };
    });

    ct.querySelectorAll('button[data-itembuy]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-itembuy');
        const item = items.find(i=>i.key===key);
        if (totalCoins >= item.cost && !item.owned) {
          totalCoins -= item.cost;
          localStorage.setItem('birdyCoinsEarned', totalCoins);
          updateScore();
          if(key==='Revive.png') {
            storedRevives = 1;
            localStorage.setItem('birdyRevives', storedRevives);
            updateReviveDisplay();
          } else if(key==='Double.png') {
            storedDoubles = 1;
            localStorage.setItem('birdyDouble', storedDoubles);
          } else if(key=="birdieV2.png") {
            adventurePlays = Math.min(adventurePlays + 5, ADVENTURE_MAX);
            localStorage.setItem("birdyAdventurePlays", adventurePlays);
            updateAdventureInfo();
          }
          trackEvent('shop_item_purchased', { item: key });
          render();
        }
      };
    });

    ct.querySelectorAll('button[data-equip]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-equip');
        defaultSkin = key;
        localStorage.setItem('birdySkin', defaultSkin);
        birdSprite.src = 'assets/' + defaultSkin;
        render();
      };
    });


    document.getElementById('shopHome').onclick = () => {
      ov.style.display = 'none';
      menuEl.style.display = 'block';
    };
  }

  ov.style.display = 'block';
  render();
}

function renderUpgradeTree() {
  const tree = document.getElementById("upgradeTree");
  tree.innerHTML = "";

  upgradeTreeConfig.forEach(branch => {
    branch.upgrades.forEach(upg => {
      const cost = Math.round((branch.costBase * Math.pow(upg.costFactor, upg.tier)) / 5) * 5;
      const owned = ownedUpgrades.includes(upg.id);
      const equipped = equippedUpgrades.includes(upg.id);
      const node = document.createElement("div");
      node.className = "upgradeNode";
      if(equipped) node.classList.add("equipped");
      else if(owned) node.classList.add("owned");
      else node.classList.add("locked");
      node.style.borderColor = branch.color;


      const img = document.createElement("img");
      img.src = "assets/" + upg.icon;
      img.className = "iconBounce";
      node.appendChild(img);

      if(!owned){
        const price = document.createElement("div");
        price.className = "priceTag";
        price.textContent = cost + ' 🪙';
        node.appendChild(price);
      }
      node.style.cursor = "pointer";
      node.addEventListener("click", () => {
        if (!owned) {
          if (upg.parent && !ownedUpgrades.includes(upg.parent)) {
            showTooltip("Requires previous upgrade");
            return;
          }
          if (totalCoins >= cost) {
            totalCoins -= cost;
            localStorage.setItem("birdyCoinsEarned", totalCoins);
            ownedUpgrades.push(upg.id);
            localStorage.setItem("ownedUpgrades", JSON.stringify(ownedUpgrades));
            if (equippedUpgrades.length < equipSlots) equippedUpgrades.push(upg.id);
            localStorage.setItem("equippedUpgrades", JSON.stringify(equippedUpgrades));
            applyEquippedUpgrades();
            renderUpgradeTree();
            updateUpgradeStats();
          } else {
            showTooltip("Need " + cost + " coins");
          }
        } else if (equipped) {
          equippedUpgrades = equippedUpgrades.filter(id => id !== upg.id);
          localStorage.setItem("equippedUpgrades", JSON.stringify(equippedUpgrades));
          applyEquippedUpgrades();
          renderUpgradeTree();
          updateUpgradeStats();
        } else {
          if (equippedUpgrades.length >= equipSlots) {
            showTooltip("No empty slots");
            return;
          }
          equippedUpgrades.push(upg.id);
          localStorage.setItem("equippedUpgrades", JSON.stringify(equippedUpgrades));
          applyEquippedUpgrades();
          renderUpgradeTree();
          updateUpgradeStats();
        }
      });
      tree.appendChild(node);
    });
  });
}


// click outside panel to restart
document.getElementById('overlay').addEventListener('click', e => {
  if (revivePromptActive) return;
  if (e.target === e.currentTarget) {
    document.getElementById('overlay').style.display = 'none';
    if (state === STATE.Start) {
      menuEl.style.display = 'block';
    }
    if (state === STATE.Over) {
      resetGame();
    }
  }
});

// Flap on click or touch (also hide overlay & reset if visible)
function flapHandler(e){
  if (state === STATE.MechaTransit || state === STATE.BossExplode) {
    e.preventDefault();
    return;
  }
  if(revivePromptActive) return;
  const ov = document.getElementById('overlay');
  if (ov.style.display === 'block') {
    ov.style.display = 'none';
    if (state === STATE.Over) { // only reset if we *were* on the game-over screen
      resetGame();
    }
    return;                     // ← bail out so we don't flap immediately
  }

  if (state === STATE.Start) {
    startAdventure();
  } else if (state === STATE.Play || state === STATE.Boss) {
    bird.flap();
    // always allow shooting in Boss fight (regardless of inMecha)
      const shots = tripleShot ? 3 : 1;
      const isFire = defaultSkin === 'FireSkinBase.png' ||
                     birdSprite.src.includes('FireSkinMech');
      const isAqua = defaultSkin === 'AquaSkinBase.png' ||
                     birdSprite.src.includes('AquaSkinMech');
      const isCow  = defaultSkin === 'cow_down.png' ||
                     birdSprite.src.includes('cow_mech');
      const isPenguin = defaultSkin === 'penguin1.png' ||
                        birdSprite.src.includes('penguinmecha');
      const rocketType = specialRocket || (isFire ? 'fire' : isAqua ? 'ice' : isCow ? 'cow' : isPenguin ? 'penguin' : 'normal');
      for(let s=0;s<shots;s++){
        if(discModeTimer>0 && state !== STATE.Boss){
          slicingDisks.push({
            x: bird.x + 40,
            y: bird.y + (s - (shots-1)/2) * 8,
            vx: 4,
            vy: 0,
            rot: 0,
            hp: 1,
            enemy: false,
            damage: 20 * rocketDamageMult,
            pulse: true
          });
        } else {
          const baseSize = (tripleShot ? 20 : 16) * rocketSizeMult;
          const erratic = bossEncounterCount === 4 && bird.stunTimer > 0;
          rocketsOut.push({
            x: bird.x + 40,
            y: bird.y + (s - (shots-1)/2) * 8,
            vx: 4,
            vy: erratic ? (Math.random()-0.5)*2 : 0,
            erratic,
            damage: (tripleShot ? 20 : 10) * rocketDamageMult,
            triple: tripleShot,
            electric: tripleElectric,
            money: defaultSkin === 'MoneySkin.png',
            bat: isBatSkin(),
            size: baseSize,
            flame: rocketFlameEnabled || rocketType==='fire',
            type: rocketType
          });
          if (defaultSkin === 'MoneySkin.png') {
            spawnMoneyLeaf(bird.x, bird.y, (Math.random()-0.5)*0.5, 1+Math.random());
          }
        }
      }
    const bubbleShot = defaultSkin === 'AquaSkinBase.png' ||
                       birdSprite.src.includes('AquaSkinMech');
    const pageShot = defaultSkin === 'story_bird.png' ||
                     birdSprite.src.includes('Story_mech');
    if (bubbleShot) {
      for (let b = 0; b < 8; b++) {
        skinParticles.push({
          x: bird.x,
          y: bird.y,
          vx:(Math.random()-0.5)*3,
          vy:(Math.random()-0.5)*3,
          size:3+Math.random()*3,
          life:20,
          max:20,
          type:'bubble'
        });
      }
    }
    if (pageShot) {
      for (let p = 0; p < 8; p++) {
        skinParticles.push({
          x: bird.x,
          y: bird.y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          size: 3 + Math.random() * 3,
          life: 80,
          max: 80,
          type: 'page',
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.05
        });
      }
    }
  }
}
canvas.addEventListener('mousedown', flapHandler);
canvas.addEventListener('touchstart',  e => { e.preventDefault(); flapHandler(e); }, {passive:false});
document.addEventListener('keydown', e=>{
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.code === 'ArrowUp') flapHandler(e);
});
        function drawUI(){
      if(state === STATE.Start){
        // dark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,W,H);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';

        const menuRect = menuEl.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const scale = H / canvasRect.height;
        const nameY  = Math.max(60, (menuRect.top - canvasRect.top) * scale - 20);
        const questY = (menuRect.bottom - canvasRect.top) * scale + 20;

        const quest = nextAchievementDesc();
        if (quest) {
          ctx.save();
          ctx.font = '18px sans-serif';
          ctx.globalAlpha = 0.5 + 0.5*Math.sin(frames/20);
          ctx.fillText(`Next Quest: ${quest}`, W/2, questY);
          ctx.restore();
        }

      }
    }
    // screen-shake state
let shakeTimer = 0, shakeMagnitude = 0;
function triggerShake(mag) {
  shakeTimer = 15;
  shakeMagnitude = mag;
}
function applyShake() {
  if (shakeTimer > 0) {
    const dx = (Math.random() * 2 - 1) * shakeMagnitude;
    const dy = (Math.random() * 2 - 1) * shakeMagnitude;
    canvas.style.transform = `translate(${dx}px,${dy}px)`;
    shakeTimer--;
  } else {
    canvas.style.transform = '';
  }
}

    function loop(){
      if (paused) return;
      frames++;
      if (bird.y < H * 0.1) topStayTimer++; else topStayTimer = 0;

      if (topStayTimer > 180 && !cheeseKiller) {
        spawnCheeseKiller();
      }
      if (slowMoTimer > 0) slowMoTimer--;
      if (inMecha && !storyLog['Arcane_Harmony'] && frames - mechaStartFrame >= 1800) {
        triggerStoryEvent('Arcane_Harmony');
      }
      if (inMecha && !storyLog['Mecha_Mastery'] && frames - mechaStartFrame >= 3600) {
        triggerStoryEvent('Mecha_Mastery');
      }
      if(reviveTimer>0) reviveTimer--;
      if (radialHitCooldown > 0) radialHitCooldown--;
  // ── Boss fight branch ──────────────────────────────────
if (state === STATE.Boss) {
  // 1) clear the canvas
  ctx.clearRect(0, 0, W, H);

  // 2) redraw your world with effects
  applyShake();
  drawBackground();
  updateSkinParticles();
  updateSnowflakes();
  updateColumnFlames();
  updateColumnSnow();
  updateMoneyLeaves();
  updateBoss();
  updateRockets();
  updatePipes();

  // 3) let the bird respond to gravity/flap
  bird.update();
  updateReviveEffect();
  updateDoubleEffect();
  updateElectricEffect();
  updateMagnetEffect();
  updateBatThrust();
  updateBatSwarms();
  updateSonarRings();
  updatePulseRings();
  updatePipeClouds();
  updateSmell();
  updateHeavyBall();
  bird.draw();

  // 4) draw the boss on top
  drawBoss();

  animationId = requestAnimationFrame(loop);
  return;
}

if (state === STATE.BossExplode) {
  ctx.clearRect(0,0,W,H);
  drawBackground();
  applyShake();
  if (frames % 12 === 0) {
    const rx = bossObj.x + (Math.random()-0.5) * bossObj.r * 2;
    const ry = bossObj.y + (Math.random()-0.5) * bossObj.r * 2;
    spawnExplosion(rx, ry);
  }
  drawBoss();
  updateExplosions();
  updateImpactParticles();
  updateStaggerSparks();
  updateMilkParticles();
  updateElectricBolts();
  updateElectricEffect();
  updateBatThrust();
  updateBatSwarms();
  updateSonarRings();
  updatePulseRings();
  updateSkinParticles();
  updateSnowflakes();
  updateColumnFlames();
  updateColumnSnow();
  updateMoneyLeaves();
  bird.draw();
  if (--bossExplosionTimer <= 0) {
    state = STATE.Play;
    if (gauntletMode) {
      const stageTime = Math.floor((frames - gauntletRocketStart) / 60);
      const coinsEarned = coinCount - gauntletCoinStart;
      const timeGrade = stageTime < 30 ? 'S' : stageTime < 40 ? 'A' : stageTime < 50 ? 'B' : 'C';
      const coinGrade = coinsEarned > 10 ? 'S' : coinsEarned > 7 ? 'A' : coinsEarned > 4 ? 'B' : coinsEarned > 2 ? 'C' : 'D';
      showStageScore([
        `Time <span class="grade ${timeGrade}">${timeGrade}</span>`,
        `Coins <span class="grade ${coinGrade}">${coinGrade}</span>`
      ]);
      flyingArmor.push({ img: armorPiece1, x: bird.x, y: bird.y, vx:-2, vy:-3 });
      flyingArmor.push({ img: armorPiece2, x: bird.x, y: bird.y, vx: 2, vy:-3 });
      coinCount = 10;
      gauntletCoinStart = coinCount;
      rocketsSpawned = 0;
      gauntletRocketStart = frames;
      spawnRocketWave();
      inMecha = true;
      mechaTriggered = true;
      mechaMusic.play().catch(() => {});
    }
  }
  animationId = requestAnimationFrame(loop);
  return;
}


// ── if we’re mid-transition, only run mech staging/draw, no game logic ──
if (state === STATE.MechaTransit) {
    if (altMecha) {
      for (let i = 0; i < 8; i++) {
        if (altMecha === 'money') {
          spawnMoneyLeaf(bird.x, bird.y, (Math.random() - 0.5) * 0.5, 1 + Math.random());
        } else if (altMecha === 'penguin') {
          snowflakes.push({
            x: bird.x,
            y: bird.y,
            vx:(Math.random()-0.5)*4,
            vy:(Math.random()-0.5)*4,
            rot:Math.random()*Math.PI*2,
            vrot:(Math.random()-0.5)*0.1,
            size:8+Math.random()*3,
            life:40
          });
        } else {
          const type = altMecha === 'fire' ? 'fire'
                      : (altMecha === 'aqua' || altMecha === 'cow') ? 'bubble'
                      : altMecha === 'bat' ? 'darkSmoke'
                      : 'page';
          const life = type === 'page' ? 80 : 20;
          const p = {
            x: bird.x,
            y: bird.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: 4 + Math.random() * 3,
            life,
            max: life,
            type,
            shape: ['circle', 'triangle', 'square'][Math.floor(Math.random() * 3)]
          };
          if (type === 'page') {
            p.rot  = Math.random() * Math.PI * 2;
            p.vrot = (Math.random() - 0.5) * 0.05;
          }
          skinParticles.push(p);
          if ((altMecha === 'fire' || altMecha === 'bat') && Math.random() < 0.5) {
            skinParticles.push({
              x: bird.x,
              y: bird.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              size: 4 + Math.random() * 4,
              life: 25,
              max: 25,
              type: altMecha === 'bat' ? 'darkSmoke' : 'smoke'
            });
          }
        }
      }
    altMechaTimer--;
    triggerShake(15);
    if (altMechaTimer <= 0) {
      inMecha = true;
      mechaSafeExpiry = frames + 120;
      birdSprite.src = altMecha === 'fire'
        ? 'assets/FireSkinMech.png'
        : altMecha === 'aqua'
          ? 'assets/AquaSkinMech.png'
          : altMecha === 'cow'
            ? 'assets/cow_mech.png'
            : altMecha === 'story'
              ? 'assets/Story_mech.png'
              : altMecha === 'bat'
                ? 'assets/mech_bat.png'
                : altMecha === 'penguin'
                  ? 'assets/penguinmechaBase.png'
                  : 'assets/MoneyMech.png';
      console.log('🦾 FULL MECHA ENGAGED!');
      showAchievement('🦾 Mecha Suit Assembled');
      triggerStoryEvent('Suit_Assembled');
      mechaStartFrame = frames;
      if (gauntletMode) {
        gauntletCoinStart = coinCount;
        gauntletRocketStart = frames;
      }
      state = STATE.Play;
      rocketsSpawned = 0;
      mechaStartScore = score;
      altMecha = null;
    }
  } else if (mechaTriggered && !inMecha) {
    transitionTimer++;
    const dur = 80;
    if (transitionTimer === dur * (mechaStage + 1) && mechaStage < mechaStages.length) {
      birdSprite.src = mechaStages[mechaStage];
      triggerShake(15);
      mechaStage++;
    }
    if (mechaStage === mechaStages.length) {
      inMecha = true;
      mechaSafeExpiry = frames + 120;
      console.log('🦾 FULL MECHA ENGAGED!');
      showAchievement('🦾 Mecha Suit Assembled');
      triggerStoryEvent('Suit_Assembled');
      mechaStartFrame = frames;
      if (gauntletMode) {
        gauntletCoinStart = coinCount;
        gauntletRocketStart = frames;
      }
      state = STATE.Play;
      rocketsSpawned = 0;
      mechaStartScore = score;
    }
  }
  applyShake();
  drawBackground();
  updateSkinParticles();
  updateSnowflakes();
  updateColumnFlames();
  updateColumnSnow();
  updateMoneyLeaves();
  // ── draw & animate any flying armor pieces ──
for (let j = flyingArmor.length - 1; j >= 0; j--) {
  const a = flyingArmor[j];
  a.vy += 0.2;       // gravity
  a.x  += a.vx;
  a.y  += a.vy;
  ctx.drawImage(a.img, a.x - 16, a.y - 16, 32, 32);
  if (a.x < -50 || a.x > W + 50 || a.y > H + 50) {
    flyingArmor.splice(j, 1);
  }
}
  bird.draw();
  animationId = requestAnimationFrame(loop);   // skip everything else until we finish
  return;
}

// then shake
applyShake();

drawBackground();
 updateSkinParticles();
 updateSnowflakes();
 updateElectricEffect();
 updateBatThrust();
 updateBatSwarms();
 updateSonarRings();
 updatePulseRings();
 updateColumnFlames();
 updateColumnSnow();
 updateMoneyLeaves();
for (let j = flyingArmor.length - 1; j >= 0; j--) {
  const a = flyingArmor[j];
  a.vy += 0.2;
  a.x  += a.vx;
  a.y  += a.vy;
  ctx.drawImage(a.img, a.x - 16, a.y - 16, 32, 32);
  if (a.x < -50 || a.x > W + 50 || a.y > H + 50) {
    flyingArmor.splice(j, 1);
  }
}
if (state === STATE.Play) {
  // — ramp up speed & auto‐score when armored —
  if (inMecha) {
    mechSpeed += 0.02;
    currentSpeed = mechSpeed;
    if (frames % 60 === 0) {
      score++;
      updateScore();
    }
  }

  // — normal draw/update —
    bird.draw();
    updateReviveEffect();
    updateDoubleEffect();
   updateElectricEffect();
   updateMagnetEffect();
   updateBatThrust();
   updateBatSwarms();
   updateSonarRings();
   updatePulseRings();
   updatePipeClouds();
   updateSmell();
    updateHeavyBall();
    if(!gauntletMode){
      drawPipes();
    }
    updatePipes();

  // — spawn bigger, evil rocket waves when in Mecha —
  if (inMecha && frames % 60 === 0) {
    const rCount = bossesDefeated >= 2 ? 2 : 3;
    for (let i = 0; i < rCount; i++) {
      rocketsIn.push({
        x: W + 20 + i * 60,
        y: Math.random() * (H - 100) + 50,
        vx: -3
      });
      rocketsSpawned++;
    }
      if (bossesDefeated >= 2 && frames % 180 === 0) spawnSliceDisk();

    if (Math.random() < baseTripleProb / 4) {
      const ry = Math.random() * (H - 80) + 40;
      rocketPowerups.push({
        x: W + 40,
        y: ry,
        taken: false
      });
    }

    // occasional bonus coins during Mecha
    let bonusP = 0.5 / 4;
    if (defaultSkin === 'MoneySkin.png') bonusP *= 1.2;
    if (Math.random() < bonusP) {
      const cy = Math.random() * (H - 80) + 40;
      coins.push({ x: W + 40, y: cy, taken: false });
    }

    if (rocketsSpawned >= 30 && frames % 132 === 0) spawnJelly();

      // homing bomb (only after 1 boss, and only 25% of those seconds)
  if (bossEncounterCount > 0 && Math.random() < 0.25) {
    stage2Bombs.push({
      x:  W + 40,
      y:  Math.random() * (H - 100) + 50,
      vx: -0.5,
      hits: 0,
      homingActive: false
    });
  }
  }



    if (inMecha) {
    if(reviveTimer<=0){
      updateRockets();
      updateJellies();
    }
  }
  updateSliceDisks();
  updateCheeseKiller();
  bird.update();

} else {
  // Start or Over screen
  bird.draw();
  drawUI();
}
        // ── FORCE SECOND BOSS AT 30 POINTS ────────────────────
        // as soon as score reaches 30, kick off a boss fight—no rocket count needed
       // if (score >= 30 && state === STATE.Play && !bossActive) {
        //  startBossFight();
       // }

      // — draw SPEED UP flash if active —
      if (speedFlashTimer > 0) {
         speedFlashTimer--;
         ctx.save();
         ctx.fillStyle = 'rgba(255,255,0,0.8)';
         ctx.font      = '24px sans-serif';
         ctx.textAlign= 'center';
         ctx.fillText('🚀 SPEED UP!', W/2, H/4);
         ctx.restore();
 }
      if(superTimer>0) superTimer--;
      animationId = requestAnimationFrame(loop);
    }
    updateScore();
    loop();
    updateAdventureInfo();
    updateAdventureTimer();
    setInterval(updateAdventureTimer,1000);
    Promise.all([
      fetchTopGlobalScores(false),
      fetchTopGlobalScores(true)
    ]).then(([adv, mar]) => {
      const ov = document.getElementById('overlay');
      ov.style.display = 'block';
      showHighScores(adv, mar, true);
    });

  })();
