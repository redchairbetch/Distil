// TNS (Treatment Not Started) Campaign Content Library
// For patients tested/identified as candidates but not yet fitted
// 7-phase drip campaign over ~6 months (26 weeks)
// Trigger: manual enrollment or test_date based
//
// Phases:
//   1. Warm Welcome & Normalization  (Week 0-1)
//   2. Brain Health & Evidence        (Week 2-4)
//   3. Myth Busting                   (Week 4-8)
//   4. Modern Technology              (Week 8-12)
//   5. Cost Reframe & Insurance       (Week 12-16)
//   6. Social Proof & Testimonials    (Week 16-20)
//   7. Re-engagement & Urgency        (Week 20-26)
//
// Terminology compliance:
//   - No "Neurotechnology" (trademarked)
//   - No "Premium" in patient-facing copy (use "Select")
//   - No "Trial" or "Demo" (use "evaluation" or "adaptation period")
//   - Devices, not "hearing aids" in some contexts for destigmatization

export const TNS_CONTENT_LIBRARY = [

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: WARM WELCOME & NORMALIZATION (Week 0-1)
  // Goal: Validate their experience, normalize hearing changes
  // ═══════════════════════════════════════════════════════════════

  {
    n: 1,
    cat: "tns_welcome",
    type: "sms",
    ch: "sms",
    title: "Thanks for Your Visit",
    body: "Thank you for coming in for your hearing evaluation. We know it's a big step. Your results are on file whenever you're ready to discuss next steps — no rush, no pressure.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Welcome",
    week: "0",
    tone: "Warm",
    objection: null
  },
  {
    n: 2,
    cat: "tns_welcome",
    type: "email",
    ch: "email",
    title: "Your Hearing Evaluation Results — What They Mean",
    body: "A personalized summary of what we found during your hearing test. Your audiogram explained in plain language, what the numbers mean for your daily life, and what options are available when you're ready.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Welcome",
    week: "0",
    tone: "Educational",
    objection: null
  },
  {
    n: 3,
    cat: "tns_normalize",
    type: "sms",
    ch: "sms",
    title: "You're Not Alone",
    body: "Nearly 1 in 5 Americans have some degree of hearing loss. Hearing changes are a normal part of life — and most people notice them around age 50, not 80.",
    src: "NIDCD Quick Statistics",
    url: "https://www.nidcd.nih.gov/health/statistics/quick-statistics-hearing",
    phase: "Welcome",
    week: "1",
    tone: "Reassuring",
    objection: "stigma"
  },
  {
    n: 4,
    cat: "tns_normalize",
    type: "email",
    ch: "email",
    title: "Hearing Loss Starts Earlier Than You Think",
    body: "Most people assume hearing loss is something that happens in your 70s or 80s. The reality? Hearing changes typically begin in your 40s and 50s. Noise exposure, genetics, and medical conditions mean this isn't an 'old age' issue — it's a human one.",
    src: "Tandfonline 2024 Qualitative Study",
    url: "https://www.tandfonline.com/doi/full/10.1080/14992027.2024.2353862",
    phase: "Welcome",
    week: "1",
    tone: "Normalizing",
    objection: "stigma"
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: BRAIN HEALTH & EVIDENCE (Week 2-4)
  // Goal: Present the stakes — untreated hearing loss isn't benign
  // ═══════════════════════════════════════════════════════════════

  {
    n: 5,
    cat: "tns_brain_health",
    type: "sms",
    ch: "sms",
    title: "Your Hearing and Your Brain",
    body: "Did you know? The Lancet Commission identified hearing loss as the #1 modifiable risk factor for dementia — bigger than smoking, depression, or physical inactivity.",
    src: "Lancet Commission on Dementia (2020)",
    url: "https://www.thelancet.com/commissions/dementia",
    phase: "Brain Health",
    week: "2",
    tone: "Informative",
    objection: "not_bad_enough"
  },
  {
    n: 6,
    cat: "tns_brain_health",
    type: "email",
    ch: "email",
    title: "The Hidden Connection: Hearing Loss and Cognitive Decline",
    body: "Research from Johns Hopkins found that even mild hearing loss doubles your risk of cognitive decline. Moderate loss triples it. The reason? When your brain struggles to hear, it pulls resources away from memory and thinking. Treating hearing loss early helps keep those neural pathways active.",
    src: "Johns Hopkins / Dr. Frank Lin",
    url: "https://publichealth.jhu.edu/2021/hearing-loss-and-the-dementia-connection",
    phase: "Brain Health",
    week: "2",
    tone: "Educational",
    objection: "not_bad_enough"
  },
  {
    n: 7,
    cat: "tns_brain_health",
    type: "sms",
    ch: "sms",
    title: "48% — A Number Worth Knowing",
    body: "The ACHIEVE trial (published in The Lancet, 2023) found that treating hearing loss reduced cognitive decline by 48% over 3 years in at-risk older adults. That's a remarkable result from a simple intervention.",
    src: "ACHIEVE Study / The Lancet (2023)",
    url: "https://www.achievestudy.org/key-findings",
    phase: "Brain Health",
    week: "3",
    tone: "Authoritative",
    objection: "deal_with_later"
  },
  {
    n: 8,
    cat: "tns_brain_health",
    type: "email",
    ch: "email",
    title: "What Happens When Hearing Loss Goes Untreated",
    body: "Over 10 years, untreated hearing loss increases your risk of dementia by 50%, depression by 40%, and falls by 30%. It's not just about missing words — it's about what happens to your brain, your mood, and your safety when sound input decreases year after year.",
    src: "Johns Hopkins Medicine",
    url: "https://www.hopkinsmedicine.org/health/wellness-and-prevention/the-hidden-risks-of-hearing-loss",
    phase: "Brain Health",
    week: "3",
    tone: "Caring/Urgent",
    objection: "deal_with_later"
  },
  {
    n: 9,
    cat: "tns_brain_health",
    type: "sms",
    ch: "sms",
    title: "The Auditory Deprivation Effect",
    body: "Your brain adapts to what it receives. When hearing loss goes untreated, the brain gradually loses its ability to process speech sounds — even if hearing is later restored. Earlier treatment preserves more.",
    src: "Audiology best practice",
    url: "",
    phase: "Brain Health",
    week: "4",
    tone: "Educational",
    objection: "deal_with_later"
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: MYTH BUSTING (Week 4-8)
  // Goal: Systematically dismantle the most common barriers
  // ═══════════════════════════════════════════════════════════════

  {
    n: 10,
    cat: "tns_myth",
    type: "email",
    ch: "email",
    title: "Myth: \"My Hearing Isn't Bad Enough for Hearing Aids\"",
    body: "This is the most common thing we hear. The truth? If you're struggling in background noise, asking people to repeat themselves, or turning up the TV — your hearing IS affecting your quality of life. You don't need to be profoundly deaf to benefit. Most candidates have mild to moderate loss.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Myth Busting",
    week: "4",
    tone: "Validating",
    objection: "not_bad_enough"
  },
  {
    n: 11,
    cat: "tns_myth",
    type: "sms",
    ch: "sms",
    title: "Quick Myth Buster",
    body: "\"I can hear fine — people just mumble.\" Sound familiar? That's actually a classic sign of high-frequency hearing loss. You hear volume, but miss clarity. That's exactly what modern devices are designed for.",
    src: "ASHA",
    url: "https://www.asha.org/public/hearing/types-of-hearing-loss/",
    phase: "Myth Busting",
    week: "5",
    tone: "Relatable",
    objection: "not_bad_enough"
  },
  {
    n: 12,
    cat: "tns_myth",
    type: "email",
    ch: "email",
    title: "Myth: \"Hearing Aids Just Make Everything Louder\"",
    body: "That was true 20 years ago. Today's devices use AI and directional microphones to separate speech from noise. They adapt automatically to your environment — restaurant, car, quiet room. They amplify what you need and suppress what you don't. It's targeted hearing enhancement, not a volume knob.",
    src: "Starkey / Hearing Review",
    url: "https://www.starkey.com/blog/articles/2023/01/common_hearing_aid_myths_debunked",
    phase: "Myth Busting",
    week: "5",
    tone: "Tech-forward",
    objection: "dont_work"
  },
  {
    n: 13,
    cat: "tns_myth",
    type: "sms",
    ch: "sms",
    title: "The \"My Uncle\" Problem",
    body: "\"My uncle had hearing aids and hated them.\" We hear this a lot. But devices have changed dramatically. That's like judging smartphones by a 2005 flip phone. Today's tech is a completely different experience.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Myth Busting",
    week: "6",
    tone: "Relatable",
    objection: "dont_work"
  },
  {
    n: 14,
    cat: "tns_myth",
    type: "email",
    ch: "email",
    title: "Myth: \"Hearing Aids Make You Look Old\"",
    body: "Here's the thing: constantly asking 'what?' and responding incorrectly to conversations is far more noticeable than any device. Modern hearing devices are virtually invisible. Some sit completely inside your ear canal. Others look like wireless earbuds. And they connect to your phone via Bluetooth for streaming calls and music.",
    src: "Alliance Center for Hearing",
    url: "https://alliancecenterforhearing.com/10-common-misconceptions-about-hearing-aids-debunked/",
    phase: "Myth Busting",
    week: "6",
    tone: "Matter-of-fact",
    objection: "vanity"
  },
  {
    n: 15,
    cat: "tns_myth",
    type: "sms",
    ch: "sms",
    title: "Nobody Notices",
    body: "Nobody notices your hearing devices. Everyone notices when you can't follow the conversation.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Myth Busting",
    week: "7",
    tone: "Direct",
    objection: "vanity"
  },
  {
    n: 16,
    cat: "tns_myth",
    type: "email",
    ch: "email",
    title: "Myth: \"I Only Need One Hearing Aid\"",
    body: "Most hearing loss is bilateral — both ears. Treating only one ear leaves the other to continue declining (auditory deprivation). Two devices provide better sound localization, clearer speech in noise, and balanced input to your brain. It's like wearing one lens in your glasses — technically possible, but you're missing half the picture.",
    src: "Audiology best practice",
    url: "",
    phase: "Myth Busting",
    week: "7",
    tone: "Educational",
    objection: "not_bad_enough"
  },
  {
    n: 17,
    cat: "tns_myth",
    type: "sms",
    ch: "sms",
    title: "Myth: \"I'll Just Turn Up the TV\"",
    body: "Compensating behaviors — turning up the TV, avoiding restaurants, nodding along — strain relationships. Your spouse, family, and friends feel the impact too. Research calls it 'third-party disability.'",
    src: "NPR / PMC systematic review",
    url: "https://www.npr.org/sections/health-shots/2019/09/12/760231279/untreated-hearing-loss-linked-to-loneliness-and-isolation-for-seniors",
    phase: "Myth Busting",
    week: "8",
    tone: "Empathetic",
    objection: "not_bad_enough"
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: MODERN TECHNOLOGY (Week 8-12)
  // Goal: Reframe hearing devices as modern consumer tech
  // ═══════════════════════════════════════════════════════════════

  {
    n: 18,
    cat: "tns_tech",
    type: "email",
    ch: "email",
    title: "These Aren't Your Grandfather's Hearing Aids",
    body: "Today's hearing devices feature: AI-powered noise management that adapts in real time. Bluetooth streaming for phone calls, music, and TV. Rechargeable lithium-ion batteries that last 30+ hours. Smartphone apps for personalized control. Some are completely invisible inside your ear canal. Think of them as smart earbuds that also happen to restore your hearing.",
    src: "Hearing Review / Industry overview",
    url: "https://hearingreview.com/",
    phase: "Technology",
    week: "8",
    tone: "Exciting",
    objection: "dont_work"
  },
  {
    n: 19,
    cat: "tns_tech",
    type: "sms",
    ch: "sms",
    title: "Bluetooth Built In",
    body: "Stream phone calls, music, podcasts, and TV audio directly to your hearing devices. No wires, no accessories. Just clear sound, personalized for your hearing profile.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Technology",
    week: "9",
    tone: "Tech-forward",
    objection: "dont_work"
  },
  {
    n: 20,
    cat: "tns_tech",
    type: "email",
    ch: "email",
    title: "How AI Is Changing Hearing Care",
    body: "Modern hearing devices analyze your sound environment thousands of times per second. In a restaurant? They focus on the voice across the table and reduce background clatter. In the car? They suppress road noise while keeping conversation clear. At home? They settle into a natural, comfortable setting. All automatically — no buttons to push.",
    src: "Signia / Starkey AI features",
    url: "",
    phase: "Technology",
    week: "10",
    tone: "Educational",
    objection: "dont_work"
  },
  {
    n: 21,
    cat: "tns_tech",
    type: "sms",
    ch: "sms",
    title: "No More Tiny Batteries",
    body: "Drop them in the charger at night, pick them up in the morning. Rechargeable batteries last up to 30 hours. A 15-minute quick charge gets you through an evening out.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Technology",
    week: "10",
    tone: "Practical",
    objection: "complicated"
  },
  {
    n: 22,
    cat: "tns_tech",
    type: "email",
    ch: "email",
    title: "Invisible, Discreet, and Powerful",
    body: "Worried about appearance? Today's devices come in every form factor: Completely-in-canal models that nobody can see. Behind-the-ear styles matched to your hair or skin tone. Slim receiver-in-canal designs that look like wireless earbuds. The technology has come a long way — and so has the design.",
    src: "Starkey / Signia product lines",
    url: "",
    phase: "Technology",
    week: "11",
    tone: "Reassuring",
    objection: "vanity"
  },
  {
    n: 23,
    cat: "tns_tech",
    type: "sms",
    ch: "sms",
    title: "Auracast Is Coming",
    body: "Bluetooth LE Audio (Auracast) is rolling out in airports, theaters, and public venues. Hearing devices will pick up crystal-clear audio broadcasts directly — like personal subtitles for the real world.",
    src: "Bluetooth SIG / Industry news",
    url: "",
    phase: "Technology",
    week: "12",
    tone: "Forward-looking",
    objection: "dont_work"
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: COST REFRAME & INSURANCE (Week 12-16)
  // Goal: Address cost objections with data and insurance info
  // ═══════════════════════════════════════════════════════════════

  {
    n: 24,
    cat: "tns_cost",
    type: "email",
    ch: "email",
    title: "The Real Cost of NOT Treating Hearing Loss",
    body: "Untreated hearing loss costs up to $30,000 per year in lost income. Nationally, that's $176 billion in aggregate. Hearing devices reduce income loss by 90-100% for mild loss and 65-77% for moderate to severe. The question isn't whether you can afford hearing devices — it's whether you can afford not to treat your hearing.",
    src: "Hearing Health Foundation / BHI",
    url: "https://hearinghealthfoundation.org/workplace-hearing-loss",
    phase: "Cost Reframe",
    week: "12",
    tone: "Data-driven",
    objection: "cost"
  },
  {
    n: 25,
    cat: "tns_cost",
    type: "sms",
    ch: "sms",
    title: "Your Insurance May Cover More Than You Think",
    body: "Many insurance plans now include hearing device benefits. We can check your specific coverage — there's no cost or obligation to find out what your plan offers.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Cost Reframe",
    week: "13",
    tone: "Helpful",
    objection: "cost"
  },
  {
    n: 26,
    cat: "tns_cost",
    type: "email",
    ch: "email",
    title: "Understanding Your Hearing Benefit",
    body: "Here's what a hearing benefit typically includes: Devices at reduced cost through your plan's network. Professional fitting and programming included. Follow-up visits for adjustments during your evaluation period. Warranty coverage for repairs and loss. We work with TruHearing, UHCH, and other major networks. Let us check what your plan covers — no pressure, just information.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Cost Reframe",
    week: "14",
    tone: "Informative",
    objection: "cost"
  },
  {
    n: 27,
    cat: "tns_cost",
    type: "sms",
    ch: "sms",
    title: "Investment in Yourself",
    body: "Think of hearing devices as an investment, not an expense. Better communication, stronger relationships, sharper cognition, safer daily living. What's that worth over the next 5 years?",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Cost Reframe",
    week: "15",
    tone: "Reframing",
    objection: "cost"
  },
  {
    n: 28,
    cat: "tns_cost",
    type: "email",
    ch: "email",
    title: "Financing Options Available",
    body: "We never want cost to be the reason someone doesn't address their hearing health. Flexible payment plans, financing options, and insurance benefits can make treatment accessible. Let's have a conversation about what works for your situation.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Cost Reframe",
    week: "16",
    tone: "Supportive",
    objection: "cost"
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: SOCIAL PROOF & TESTIMONIALS (Week 16-20)
  // Goal: Real stories, celebrity examples, emotional resonance
  // ═══════════════════════════════════════════════════════════════

  {
    n: 29,
    cat: "tns_testimonial",
    type: "email",
    ch: "email",
    title: "\"I Wish I'd Done This Years Ago\"",
    body: "That's the single most common thing patients tell us after getting their devices. The average person waits nearly 9 years between noticing hearing changes and taking action. Most say their only regret is not doing it sooner.",
    src: "MarkeTrak survey data / PMC",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6363915/",
    phase: "Social Proof",
    week: "16",
    tone: "Testimonial",
    objection: "deal_with_later"
  },
  {
    n: 30,
    cat: "tns_testimonial",
    type: "sms",
    ch: "sms",
    title: "What Our Patients Say",
    body: "\"I didn't realize how much I was missing until I got my devices. Conversations are clear again. I stopped avoiding restaurants. My wife says I'm a different person.\" — Real patient feedback",
    src: "Composite patient testimonial",
    url: "",
    phase: "Social Proof",
    week: "17",
    tone: "Testimonial",
    objection: "dont_work"
  },
  {
    n: 31,
    cat: "tns_celebrity",
    type: "email",
    ch: "email",
    title: "Famous Faces Who Wear Hearing Devices",
    body: "You'd be surprised who wears hearing devices: Whoopi Goldberg wears them and talks openly about her hearing loss. Former President Bill Clinton has worn them since his 50s. Halle Berry lost 80% of hearing in one ear and continues to thrive. Rob Lowe is deaf in one ear and advocates for hearing health. Hearing loss doesn't discriminate — and treating it is nothing to hide.",
    src: "Soundly / InnoCaption",
    url: "https://www.soundly.com/blog/celebrities-with-hearing-loss",
    phase: "Social Proof",
    week: "17",
    tone: "Inspirational",
    objection: "vanity"
  },
  {
    n: 32,
    cat: "tns_testimonial",
    type: "sms",
    ch: "sms",
    title: "The Thanksgiving Moment",
    body: "So many patients tell us about 'the moment' — the first holiday dinner where they could follow the whole conversation. The first time they heard their grandchild clearly. What will your moment be?",
    src: "Composite patient testimonial",
    url: "",
    phase: "Social Proof",
    week: "18",
    tone: "Emotional",
    objection: "deal_with_later"
  },
  {
    n: 33,
    cat: "tns_relationship",
    type: "email",
    ch: "email",
    title: "It's Not Just About You",
    body: "Hearing loss doesn't just affect the person who has it. Partners repeat themselves dozens of times a day. Family members shout across rooms. Friends stop calling because phone conversations are too difficult. Researchers call it 'third-party disability' — the ripple effect on everyone around you. Treating your hearing is a gift to the people you love too.",
    src: "NPR / Hearing Health Foundation",
    url: "https://www.npr.org/sections/health-shots/2019/09/12/760231279/untreated-hearing-loss-linked-to-loneliness-and-isolation-for-seniors",
    phase: "Social Proof",
    week: "19",
    tone: "Empathetic",
    objection: "not_bad_enough"
  },
  {
    n: 34,
    cat: "tns_testimonial",
    type: "sms",
    ch: "sms",
    title: "The Spousal Perspective",
    body: "\"My husband's hearing devices didn't just change his life — they changed mine. I don't have to repeat everything. We watch TV at a normal volume. We actually talk again.\" — Real spouse feedback",
    src: "Composite spouse testimonial",
    url: "",
    phase: "Social Proof",
    week: "19",
    tone: "Testimonial",
    objection: "not_bad_enough"
  },
  {
    n: 35,
    cat: "tns_workplace",
    type: "email",
    ch: "email",
    title: "Hearing Loss at Work: The Numbers",
    body: "Untreated hearing loss affects job performance, earnings, and career trajectory. The unemployment rate for people with severe untreated loss (15.6%) is nearly double that of hearing device users (8.3%). Missing information in meetings, misunderstanding instructions, and avoiding phone calls — these add up. Your hearing is a professional asset worth protecting.",
    src: "Hearing Health Foundation",
    url: "https://hearinghealthfoundation.org/workplace-hearing-loss",
    phase: "Social Proof",
    week: "20",
    tone: "Professional",
    objection: "not_bad_enough"
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 7: RE-ENGAGEMENT & URGENCY (Week 20-26)
  // Goal: Gentle urgency, easy next steps, re-engage
  // ═══════════════════════════════════════════════════════════════

  {
    n: 36,
    cat: "tns_urgency",
    type: "email",
    ch: "email",
    title: "The Waiting Game Has a Cost",
    body: "The average person waits 8.9 years between being identified as a hearing device candidate and actually getting treatment. During that time, auditory processing pathways in the brain weaken from lack of stimulation. The sooner you act, the more hearing ability you preserve. Your brain is adapting to silence right now.",
    src: "PMC longitudinal cohort / MarkeTrak",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6363915/",
    phase: "Re-engagement",
    week: "20",
    tone: "Caring/Urgent",
    objection: "deal_with_later"
  },
  {
    n: 37,
    cat: "tns_urgency",
    type: "sms",
    ch: "sms",
    title: "Still Thinking About It?",
    body: "That's completely okay. Most people take time with this decision. But we want you to know — your test results are still on file, and we're here whenever you're ready. Even just a conversation can help.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Re-engagement",
    week: "21",
    tone: "Low-pressure",
    objection: "deal_with_later"
  },
  {
    n: 38,
    cat: "tns_easy_step",
    type: "email",
    ch: "email",
    title: "What a Follow-Up Visit Looks Like",
    body: "If you're wondering what the next step involves: It's a 30-minute conversation. We review your test results. We show you what modern devices look and feel like (you can try them on). We check your insurance coverage. There's no commitment, no obligation, and no pressure. Just information to help you decide when you're ready.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Re-engagement",
    week: "22",
    tone: "Transparent",
    objection: "deal_with_later"
  },
  {
    n: 39,
    cat: "tns_urgency",
    type: "sms",
    ch: "sms",
    title: "A Question Worth Asking",
    body: "If you knew treating your hearing loss could reduce your risk of cognitive decline by nearly half — would you still wait? The ACHIEVE trial showed exactly that. The evidence is clear. The next step is yours.",
    src: "ACHIEVE Study / The Lancet (2023)",
    url: "https://www.achievestudy.org/key-findings",
    phase: "Re-engagement",
    week: "23",
    tone: "Thought-provoking",
    objection: "deal_with_later"
  },
  {
    n: 40,
    cat: "tns_seasonal",
    type: "email",
    ch: "email",
    title: "Better Hearing for the Holidays",
    body: "The holidays are coming — family gatherings, dinner conversations, grandchildren's laughter. This is the time of year when hearing loss is felt most. Many patients choose to start treatment before the holidays so they can fully participate. If that sounds like something you'd want, we have time to get you started before the season kicks in.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Re-engagement",
    week: "seasonal",
    tone: "Warm",
    objection: "deal_with_later"
  },
  {
    n: 41,
    cat: "tns_seasonal",
    type: "sms",
    ch: "sms",
    title: "May Is Better Hearing Month",
    body: "May is Better Hearing & Speech Month! It's a great time to revisit your hearing health. Your evaluation results are still on file — let's talk about what's next.",
    src: "ASHA Better Hearing Month",
    url: "https://www.asha.org/",
    phase: "Re-engagement",
    week: "seasonal",
    tone: "Timely",
    objection: null
  },
  {
    n: 42,
    cat: "tns_reframe",
    type: "email",
    ch: "email",
    title: "What Changed Their Mind",
    body: "We asked patients who initially hesitated but eventually got treatment: What made you change your mind? The top answers: Missing something important at a family event. A spouse or loved one expressing frustration. Learning about the brain health connection. Seeing how small and discreet modern devices are. Discovering their insurance covered more than expected. Which one resonates with you?",
    src: "Distil TNS Campaign / Composite",
    url: "",
    phase: "Re-engagement",
    week: "24",
    tone: "Reflective",
    objection: "deal_with_later"
  },
  {
    n: 43,
    cat: "tns_final",
    type: "sms",
    ch: "sms",
    title: "We're Still Here",
    body: "Just a reminder: your hearing evaluation is on file, your options are open, and we're here whenever you're ready. No expiration date, no pressure. Just give us a call.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Re-engagement",
    week: "26",
    tone: "Warm",
    objection: null
  },

  // ═══════════════════════════════════════════════════════════════
  // BONUS: OBJECTION-SPECIFIC DEEP DIVES (standalone content)
  // Can be triggered manually or inserted based on patient profile
  // ═══════════════════════════════════════════════════════════════

  {
    n: 44,
    cat: "tns_objection_deep",
    type: "email",
    ch: "email",
    title: "Deep Dive: \"I Can Hear Fine in Quiet\"",
    body: "You probably can — and that's exactly the issue. Sensorineural hearing loss typically affects high-frequency sounds first. Vowels carry volume (low frequency), but consonants carry clarity (high frequency). So you hear people talking, but can't make out what they're saying — especially with background noise. This is the most common type of hearing loss and the most treatable.",
    src: "ASHA / Audiology clinical",
    url: "https://www.asha.org/public/hearing/types-of-hearing-loss/",
    phase: "Bonus",
    week: "any",
    tone: "Educational",
    objection: "not_bad_enough"
  },
  {
    n: 45,
    cat: "tns_objection_deep",
    type: "email",
    ch: "email",
    title: "Deep Dive: \"OTC Hearing Aids Are Cheaper\"",
    body: "Over-the-counter devices can help mild loss, but they're pre-programmed — not customized to your specific audiogram. Professional devices are: programmed to your exact hearing profile across all frequencies, fitted physically to your ear anatomy, adjusted over time as your hearing changes, backed by professional support, cleaning, and warranty. OTC is like reading glasses from the drugstore. Professional devices are like prescription lenses.",
    src: "FDA OTC ruling context / Audiology best practice",
    url: "",
    phase: "Bonus",
    week: "any",
    tone: "Balanced",
    objection: "cost"
  },
  {
    n: 46,
    cat: "tns_objection_deep",
    type: "email",
    ch: "email",
    title: "Deep Dive: \"I'm Too Young for Hearing Aids\"",
    body: "Hearing changes don't follow a calendar. Noise exposure, genetics, medications, and medical conditions can cause hearing loss at any age. Approximately 15% of Americans aged 18+ report some trouble hearing. Active people in their 40s, 50s, and 60s are among the fastest-growing group of hearing device users. Modern devices are designed to fit active lifestyles — moisture resistant, Bluetooth-enabled, and rechargeable.",
    src: "NIDCD / MarkeTrak demographics",
    url: "https://www.nidcd.nih.gov/health/statistics/quick-statistics-hearing",
    phase: "Bonus",
    week: "any",
    tone: "Normalizing",
    objection: "vanity"
  },
  {
    n: 47,
    cat: "tns_objection_deep",
    type: "email",
    ch: "email",
    title: "Deep Dive: \"Hearing Aids Are Complicated\"",
    body: "Today's devices are designed for simplicity: Rechargeable — drop in charger at night, wear all day. Auto-adjusting — they adapt to your environment without you touching anything. Bluetooth — stream calls and media like wireless earbuds. Smartphone app — adjust settings from your phone if you want to, but you don't have to. We handle the setup, the programming, and the fine-tuning. Your only job is to wear them.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Bonus",
    week: "any",
    tone: "Reassuring",
    objection: "complicated"
  },
  {
    n: 48,
    cat: "tns_objection_deep",
    type: "email",
    ch: "email",
    title: "Deep Dive: Depression, Isolation, and Hearing Loss",
    body: "A meta-analysis of 24 cohort studies found hearing loss is strongly associated with developing depression. A separate systematic review linked hearing loss to significantly higher rates of loneliness and social isolation. The American Academy of Audiology reports that regular hearing device use is associated with lower depression prevalence. Treating hearing loss isn't just about sound — it's about staying connected to the people and activities that matter.",
    src: "PMC meta-analyses / AAA",
    url: "https://www.audiology.org/consumers-and-patients/hearing-and-balance/depression-and-hearing-loss/",
    phase: "Bonus",
    week: "any",
    tone: "Empathetic",
    objection: "not_bad_enough"
  },

  // ═══════════════════════════════════════════════════════════════
  // PROMOTIONAL CONTENT (seasonal / event-driven)
  // ═══════════════════════════════════════════════════════════════

  {
    n: 49,
    cat: "tns_promo",
    type: "email",
    ch: "email",
    title: "Complimentary Hearing Device Demonstration",
    body: "Experience today's hearing devices firsthand — no commitment required. Try them on, hear the difference, and see how small they really are. We'll walk you through your options based on your evaluation results. Schedule a complimentary demonstration at your convenience.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Promo",
    week: "any",
    tone: "Inviting",
    objection: null
  },
  {
    n: 50,
    cat: "tns_promo",
    type: "sms",
    ch: "sms",
    title: "Free Insurance Benefit Check",
    body: "Not sure what your insurance covers for hearing devices? We'll check for you — free, fast, and no obligation. Just reply or call and we'll look up your plan.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Promo",
    week: "any",
    tone: "Helpful",
    objection: "cost"
  },
  {
    n: 51,
    cat: "tns_promo",
    type: "email",
    ch: "email",
    title: "Bring a Loved One",
    body: "Hearing is a family matter. We encourage you to bring your spouse, partner, or a close family member to your next visit. They can share their perspective on your hearing, see the devices, and be part of the conversation. Two perspectives make for better decisions.",
    src: "Distil TNS Campaign",
    url: "",
    phase: "Promo",
    week: "any",
    tone: "Warm",
    objection: null
  },
  {
    n: 52,
    cat: "tns_promo",
    type: "sms",
    ch: "sms",
    title: "World Hearing Day Reminder",
    body: "March 3 is World Hearing Day! The WHO theme this year: hearing care for all. Your evaluation is on file and we're here to help whenever you're ready.",
    src: "WHO World Hearing Day",
    url: "",
    phase: "Promo",
    week: "seasonal",
    tone: "Timely",
    objection: null
  },

  // ═══════════════════════════════════════════════════════════════
  // LANDMARK STUDY SPOTLIGHTS (deep-link educational content)
  // ═══════════════════════════════════════════════════════════════

  {
    n: 53,
    cat: "tns_research",
    type: "email",
    ch: "email",
    title: "Study Spotlight: The Lancet Commission on Dementia",
    body: "In 2017 (updated 2020), The Lancet Commission on Dementia Prevention identified 12 modifiable risk factors for dementia. Hearing loss ranked #1 — responsible for 8% of all dementia cases worldwide. That's more than smoking, physical inactivity, depression, or social isolation. The commission concluded that treating hearing loss in midlife is the single most impactful thing you can do to reduce dementia risk.",
    src: "Lancet Commission on Dementia (2017, 2020)",
    url: "https://www.thelancet.com/commissions/dementia",
    phase: "Research",
    week: "any",
    tone: "Authoritative",
    objection: "deal_with_later"
  },
  {
    n: 54,
    cat: "tns_research",
    type: "email",
    ch: "email",
    title: "Study Spotlight: The ACHIEVE Trial",
    body: "Published in The Lancet in 2023, the ACHIEVE trial is the largest randomized controlled trial of hearing intervention and cognitive decline. 977 participants aged 70-84 were studied over 3 years. Results: hearing treatment reduced cognitive decline by 48% in at-risk older adults. The trial also showed improvements in communication, social engagement, and reduced loneliness.",
    src: "ACHIEVE Study / The Lancet (2023)",
    url: "https://www.achievestudy.org/key-findings",
    phase: "Research",
    week: "any",
    tone: "Authoritative",
    objection: "deal_with_later"
  },
  {
    n: 55,
    cat: "tns_research",
    type: "email",
    ch: "email",
    title: "Study Spotlight: Johns Hopkins — The Dose-Response Link",
    body: "Dr. Frank Lin and the Johns Hopkins team established the dose-response relationship between hearing loss and cognitive decline: Mild hearing loss — 2x risk of dementia. Moderate hearing loss — 3x risk. Severe hearing loss — 5x risk. This research fundamentally changed how the medical community views untreated hearing loss — from a quality-of-life issue to a brain health imperative.",
    src: "Johns Hopkins Bloomberg School of Public Health",
    url: "https://publichealth.jhu.edu/2021/hearing-loss-and-the-dementia-connection",
    phase: "Research",
    week: "any",
    tone: "Authoritative",
    objection: "not_bad_enough"
  },
  {
    n: 56,
    cat: "tns_research",
    type: "email",
    ch: "email",
    title: "Study Spotlight: Falls and Hearing Loss",
    body: "Johns Hopkins research found that even mild hearing loss triples the risk of falling. For every additional 10 decibels of hearing loss, the risk increases by 1.4x. Why? Your ears help with balance and spatial awareness. When hearing input decreases, your brain diverts cognitive resources from maintaining stability to processing sound. Treating hearing loss helps restore that balance — literally.",
    src: "Johns Hopkins / Archives of Internal Medicine",
    url: "https://publichealth.jhu.edu/",
    phase: "Research",
    week: "any",
    tone: "Educational",
    objection: "not_bad_enough"
  }
];

// ── Objection tag reference ──
// Used for smart content selection based on patient profile or provider notes
//
// "not_bad_enough"  — Denial / minimization of hearing loss severity
// "cost"            — Price/affordability concerns
// "vanity"          — Appearance / stigma / "looking old"
// "dont_work"       — Skepticism about device effectiveness
// "deal_with_later" — Procrastination / "it's not urgent"
// "complicated"     — Fear of technology / complexity
// "stigma"          — General social stigma around hearing loss
// null              — General content, not objection-specific

export const TNS_PHASES = [
  { id: "welcome",       label: "Welcome & Normalization", weeks: "0-1",   color: "#10b981" },
  { id: "brain_health",  label: "Brain Health & Evidence",  weeks: "2-4",   color: "#6366f1" },
  { id: "myth_busting",  label: "Myth Busting",             weeks: "4-8",   color: "#f59e0b" },
  { id: "technology",    label: "Modern Technology",         weeks: "8-12",  color: "#3b82f6" },
  { id: "cost_reframe",  label: "Cost Reframe & Insurance", weeks: "12-16", color: "#ef4444" },
  { id: "social_proof",  label: "Social Proof & Stories",   weeks: "16-20", color: "#8b5cf6" },
  { id: "reengagement",  label: "Re-engagement & Urgency",  weeks: "20-26", color: "#ec4899" },
  { id: "bonus",         label: "Objection Deep Dives",     weeks: "any",   color: "#64748b" },
  { id: "promo",         label: "Promotional",              weeks: "seasonal", color: "#14b8a6" },
  { id: "research",      label: "Landmark Studies",          weeks: "any",   color: "#0ea5e9" },
];

export const TNS_OBJECTION_TAGS = [
  { id: "not_bad_enough",  label: "\"Not Bad Enough\"",     icon: "🙉", count: 0 },
  { id: "cost",            label: "Cost Concerns",           icon: "💰", count: 0 },
  { id: "vanity",          label: "Appearance / Stigma",     icon: "👁️", count: 0 },
  { id: "dont_work",       label: "\"They Don't Work\"",    icon: "🔇", count: 0 },
  { id: "deal_with_later", label: "Procrastination",         icon: "⏰", count: 0 },
  { id: "complicated",     label: "Too Complicated",         icon: "🤯", count: 0 },
  { id: "stigma",          label: "Social Stigma",           icon: "😶", count: 0 },
];

// Populate counts
TNS_OBJECTION_TAGS.forEach(tag => {
  tag.count = TNS_CONTENT_LIBRARY.filter(c => c.objection === tag.id).length;
});
