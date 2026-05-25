'use strict';

const logger = require('../../utils/logger');

// ─── RECOMMENDATION SEVERITY LEVELS ──────────────────────────────────────────
// Match exactly what the frontend renders in the recommendations section.
const SEVERITY = {
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
  LOW:      'low'
};

// ─── IMPACT LEVELS ────────────────────────────────────────────────────────────
const IMPACT = {
  TRANSFORMATIVE: 'transformative',  // will fundamentally change AI visibility
  HIGH:           'high',            // will meaningfully move the needle
  MEDIUM:         'medium',          // will improve specific dimensions
  LOW:            'low'              // incremental, supporting improvement
};

// ─── EFFORT LEVELS ────────────────────────────────────────────────────────────
const EFFORT = {
  LOW:    'low',     // can be done in days, no technical overhead
  MEDIUM: 'medium',  // weeks of consistent work
  HIGH:   'high'     // months of sustained effort or technical investment
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Build a recommendation object in the exact shape the frontend expects.
 *
 * @param {string} severity
 * @param {string} impact
 * @param {string} effort
 * @param {string} problem   - the specific gap this recommendation addresses
 * @param {string} action    - the precise, actionable thing to do
 * @param {string} result    - the specific outcome expected in AI awareness
 * @returns {{ severity, impact, effort, problem, action, result }}
 */
function buildRec(severity, impact, effort, problem, action, result) {
  return { severity, impact, effort, problem, action, result };
}

/**
 * Mean of a numeric array. Returns defaultVal if empty.
 */
function mean(arr, defaultVal = 0) {
  const valid = (arr || []).filter(n => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return defaultVal;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Check if a gap type exists in the gaps array.
 *
 * @param {Array}  gaps
 * @param {string} gapType
 * @returns {boolean}
 */
function hasGap(gaps, gapType) {
  return (gaps || []).some(g => g.gapType === gapType);
}

/**
 * Get a specific gap from the gaps array.
 *
 * @param {Array}  gaps
 * @param {string} gapType
 * @returns {object|null}
 */
function getGap(gaps, gapType) {
  return (gaps || []).find(g => g.gapType === gapType) || null;
}

// ─── MAIN EXPORT: generateRecommendations ────────────────────────────────────
/**
 * Generate a prioritised, actionable list of recommendations for improving
 * AI brand awareness. Every recommendation is specific, measurable, and
 * directly tied to the gaps and scoring data from the full analysis pipeline.
 *
 * This function uses ALL available signals:
 *
 * From scoredEngines (File 3):
 *   score, recognition, depth, accuracy, confidence
 *   informalScore, formalScore, communityPresent, recommended
 *   socialFootprint, viralitySignal, sentiment, topicsKnown, topicsUnknown
 *
 * From consistencyResult (File 4):
 *   score, label, conflicted[], dimensionScores
 *
 * From narrativeGaps (File 5):
 *   severity, gapType, brandCommunicates, aiProduces
 *
 * From overall scoring:
 *   overallScore, tier
 *
 * Design principle: recommendations address informal/social visibility
 * as primary levers alongside traditional content and SEO strategies.
 * A brand invisible in communities needs community-first recommendations,
 * not just "write more blog posts."
 *
 * Recommendations are ordered: critical → high → medium → low.
 * Capped at 8 for display. Each recommendation must be specific enough
 * that the user can act on it today without further clarification.
 *
 * @param {Object} scoredEngines      - from scoreAllEngines().scoredEngines
 * @param {Object} consistencyResult  - from analyseConsistency()
 * @param {Array}  narrativeGaps      - from identifyNarrativeGaps()
 * @param {number} overallScore       - 0–100
 * @param {string} tier               - e.g. 'NOT KNOWN', 'PARTIALLY KNOWN'
 * @param {string} domain             - the scanned domain
 * @returns {Array<{severity, impact, effort, problem, action, result}>}
 */
function generateRecommendations(
  scoredEngines,
  consistencyResult,
  narrativeGaps,
  overallScore,
  tier,
  domain
) {
  const recommendations = [];

  // ── Filter active engines ──
  const activeEntries = Object.entries(scoredEngines).filter(([, e]) => !e.failed);
  const activeCount   = activeEntries.length;

  if (activeCount === 0) {
    return [buildRec(
      SEVERITY.CRITICAL, IMPACT.TRANSFORMATIVE, EFFORT.HIGH,
      'No AI engines could be queried for this brand',
      'Ensure the domain is live, publicly accessible, and returns valid HTML — then re-run the scan',
      'Establishes baseline AI awareness data and reveals the starting point for improvement'
    )];
  }

  // ── Aggregate all signals ──
  const avgRecognition  = mean(activeEntries.map(([, d]) => d.recognition));
  const avgDepth        = mean(activeEntries.map(([, d]) => d.depth));
  const avgAccuracy     = mean(activeEntries.map(([, d]) => d.accuracy));
  const avgConfidence   = mean(activeEntries.map(([, d]) => d.confidence));
  const avgInformal     = mean(activeEntries.map(([, d]) => d.informalScore || 5));
  const avgFormal       = mean(activeEntries.map(([, d]) => d.formalScore   || 5));

  const communityCount  = activeEntries.filter(([, d]) => d.communityPresent).length;
  const viralCount      = activeEntries.filter(([, d]) => d.viralitySignal).length;
  const recommendedCount= activeEntries.filter(([, d]) => d.recommended === 'yes').length;
  const communityRatio  = communityCount  / activeCount;
  const viralRatio      = viralCount      / activeCount;
  const recommendedRatio= recommendedCount / activeCount;

  const footprints          = activeEntries.map(([, d]) => d.socialFootprint || 'unknown');
  const strongFootprintCount= footprints.filter(f => f === 'strong').length;
  const weakOrNoneCount     = footprints.filter(f => f === 'weak' || f === 'none').length;

  const sentiments          = activeEntries.map(([, d]) => d.sentiment || 'unknown');
  const hasNegativeSentiment= sentiments.some(s => s === 'negative');
  const hasMixedSentiment   = sentiments.some(s => s === 'mixed');
  const hasPositiveSentiment= sentiments.some(s => s === 'positive');
  const sentimentConflict   = hasNegativeSentiment && hasPositiveSentiment;

  const consistencyScore    = consistencyResult?.score ?? 100;
  const conflictedTopics    = consistencyResult?.conflicted || [];
  const agreedTopics        = consistencyResult?.agreed    || [];
  const sentimentAlignment  = consistencyResult?.dimensionScores?.sentimentAlignment  ?? 100;
  const informalAlignment   = consistencyResult?.dimensionScores?.informalAlignment   ?? 100;

  // Collect all topicsUnknown across engines for cross-referencing
  const allUnknownTopics = [];
  for (const [, d] of activeEntries) {
    for (const t of (d.topicsUnknown || [])) {
      allUnknownTopics.push(t.toLowerCase());
    }
  }

  // Collect all topicsKnown for cross-referencing
  const allKnownTopics = [];
  for (const [, d] of activeEntries) {
    for (const t of (d.topicsKnown || [])) {
      allKnownTopics.push(t.toLowerCase());
    }
  }

  logger.info(
    `Generating recommendations — overall: ${overallScore} | tier: ${tier} | ` +
    `recognition: ${avgRecognition.toFixed(1)} | informal: ${avgInformal.toFixed(1)} | ` +
    `community: ${communityRatio.toFixed(2)} | recommended: ${recommendedRatio.toFixed(2)}`
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL RECOMMENDATIONS
  // These address complete absence or severe misrepresentation.
  // Brand must act on these before any other improvements will have effect.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── REC: Brand completely absent from AI ──
  if (overallScore < 15 || avgRecognition < 12) {
    recommendations.push(buildRec(
      SEVERITY.CRITICAL,
      IMPACT.TRANSFORMATIVE,
      EFFORT.HIGH,
      `${domain} has no meaningful presence in AI training data — engines cannot find or describe this brand`,
      'Create a comprehensive Wikipedia article or Wikidata entry for the brand. Simultaneously publish detailed "About" and brand story content on the main domain, submit to major web directories (Crunchbase, LinkedIn Company Page, Google Business Profile), and generate at least 20 high-authority backlinks from relevant industry publications within 60 days',
      'Wikipedia and structured web data are heavily weighted in AI training pipelines — establishing these foundations will seed the brand into future AI model updates and begin building recognition from zero'
    ));
  }

  // ── REC: Recognition critically low ──
  else if (avgRecognition < 28) {
    recommendations.push(buildRec(
      SEVERITY.CRITICAL,
      IMPACT.TRANSFORMATIVE,
      EFFORT.HIGH,
      `AI engines barely acknowledge ${domain} exists — recognition score of ${Math.round(avgRecognition)}/100 indicates the brand has almost no footprint in AI training data`,
      'Prioritise three actions simultaneously: (1) Create or significantly expand the brand\'s Wikipedia presence with cited, neutral-tone content. (2) Publish a detailed, factual "About" page on the brand\'s own domain with founding story, mission, team, and product description. (3) Get the brand mentioned in at least 10 authoritative third-party sources — industry blogs, news sites, or directories — within 30 days',
      'These three channels are the highest-weight signals in AI training data. Establishing them simultaneously creates the foundational web of citations that AI systems use to recognise and describe a brand'
    ));
  }

  // ── REC: Accuracy critically low ──
  if (avgAccuracy < 25 && overallScore > 10) {
    recommendations.push(buildRec(
      SEVERITY.CRITICAL,
      IMPACT.HIGH,
      EFFORT.MEDIUM,
      `AI information about ${domain} is unreliable — high rate of conflicting or unverifiable claims (accuracy score: ${Math.round(avgAccuracy)}/100)`,
      'Conduct a "brand facts audit": identify every incorrect or conflicting claim AI systems make about this brand. For each incorrect claim, publish a clear, authoritative, cited correction on the brand\'s own domain and on Wikipedia. Create a dedicated brand fact-sheet page on the main domain with verified, citable facts in plain language',
      'AI systems weight consistent, cited, factual content heavily. Correcting misinformation at source reduces conflicting claims over time as models are retrained on updated web data'
    ));
  }

  // ── REC: Severe consistency failure ──
  if (consistencyScore < 30 && activeCount >= 2) {
    const conflictSummary = conflictedTopics.slice(0, 2).join('; ') || 'brand identity and positioning';
    recommendations.push(buildRec(
      SEVERITY.CRITICAL,
      IMPACT.HIGH,
      EFFORT.MEDIUM,
      `AI engines give severely contradictory descriptions of ${domain} — consistency score: ${consistencyScore}/100. Key conflicts: ${conflictSummary}`,
      'Implement a "single source of truth" strategy: create one definitive brand description page on the main domain that states clearly — in simple, unambiguous language — what the brand is, who it serves, what problem it solves, and how it is perceived. Then syndicate this exact language to Wikipedia, Crunchbase, LinkedIn, and all major directory listings. Consistency across sources is how AI systems resolve contradictions',
      'When AI training data consistently finds the same factual description across multiple high-authority sources, conflicting signals are overridden in future model updates'
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH RECOMMENDATIONS
  // These address major gaps in informal/social visibility and depth.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── REC: Community and social knowledge completely absent ──
  if (communityRatio === 0 && avgInformal < 3) {
    recommendations.push(buildRec(
      SEVERITY.HIGH,
      IMPACT.TRANSFORMATIVE,
      EFFORT.HIGH,
      `${domain} has zero community or social presence in AI knowledge — engines have no informal signal about this brand from forums, social media, or creator content`,
      'Launch a three-channel community strategy immediately: (1) Create and actively participate in relevant subreddits, posting helpful content about the brand\'s category — not promotional posts. (2) Encourage existing users to discuss the brand on Twitter/X, LinkedIn, and relevant Discord servers by creating shareable content, tutorials, and case studies. (3) Identify 5–10 micro-influencers or creators in the brand\'s niche and provide them genuine value — tools, access, stories — to generate authentic community discussion',
      'Community and social discussion is a major source of informal AI training signal. AI systems learn that a brand is "talked about" from the density and sentiment of discussion across these platforms. Zero community signal today means zero informal recognition in AI — building it is non-negotiable for long-term AI visibility'
    ));
  }

  // ── REC: Informal knowledge weak (present but thin) ──
  else if (avgInformal < 5 && communityRatio < 0.5 && overallScore >= 15) {
    recommendations.push(buildRec(
      SEVERITY.HIGH,
      IMPACT.HIGH,
      EFFORT.MEDIUM,
      `${domain} has limited informal/social presence in AI knowledge — formal facts exist but community and conversational signals are weak (informal score: ${avgInformal.toFixed(1)}/10)`,
      'Shift content strategy toward conversation-generating formats: publish case studies showing real user outcomes, create comparison content positioning the brand against alternatives people already search for, launch a community forum or Slack/Discord group, and actively answer questions about the brand\'s category on Quora, Reddit, and Stack Overflow',
      'Informal AI knowledge comes from the density of conversational mentions across the open web. Conversation-generating content creates the natural language signals AI systems ingest as informal brand knowledge'
    ));
  }

  // ── REC: Not being recommended by AI engines ──
  if (recommendedRatio === 0 && overallScore >= 20) {
    recommendations.push(buildRec(
      SEVERITY.HIGH,
      IMPACT.HIGH,
      EFFORT.MEDIUM,
      `No AI engine recommends ${domain} when suggesting solutions — the brand is absent from AI recommendation sets in its category`,
      'Create "best tools for [category]" and "alternatives to [competitor]" content that naturally positions the brand as a solution. Get the brand listed in established "best of" roundups and listicles in its category — these are specifically the content formats AI systems use to build recommendation knowledge. Ensure the brand has strong presence in the top 3 category-relevant communities where recommendations are made organically',
      'AI recommendation knowledge is built from the aggregated patterns of how a brand is mentioned alongside category searches and comparison content. Appearing consistently in recommendation contexts trains AI systems to include the brand in their suggestion sets'
    ));
  }

  // ── REC: Social footprint predominantly weak ──
  if (weakOrNoneCount >= Math.ceil(activeCount * 0.6) && overallScore >= 20) {
    recommendations.push(buildRec(
      SEVERITY.HIGH,
      IMPACT.HIGH,
      EFFORT.MEDIUM,
      `${domain} has a weak social footprint in AI knowledge — ${weakOrNoneCount} of ${activeCount} engines report minimal social signal`,
      'Execute a 90-day social signal amplification plan: post consistently on LinkedIn (3x/week), Twitter/X (daily), and one category-specific platform. Prioritise content formats that generate saves and shares over likes — tutorials, data insights, and strong opinions about the brand\'s industry. Track share-of-voice in relevant hashtags and communities monthly',
      'Social platform content and its engagement signals are indexed by search engines and crawled for AI training data. Consistent, high-engagement social content directly builds the social footprint signal that AI systems use to classify a brand as actively discussed'
    ));
  }

  // ── REC: Depth is low ──
  if (avgDepth < 35 && overallScore >= 20) {
    recommendations.push(buildRec(
      SEVERITY.HIGH,
      IMPACT.HIGH,
      EFFORT.MEDIUM,
      `AI knowledge of ${domain} is shallow — engines cannot describe the brand beyond surface-level category identification (depth score: ${Math.round(avgDepth)}/100)`,
      'Publish a comprehensive brand knowledge base on the main domain: detailed product/service pages, an "Our Story" narrative with founding context, a team page with real bios, a use-cases page with specific examples, and a public changelog or milestones page. Each page should be optimised for search and cross-linked. This is the web infrastructure AI systems crawl to build depth of knowledge',
      'AI depth is directly correlated with the richness of indexed content about a brand. A knowledge base gives AI systems the raw material to answer detailed questions — without it, all AI can do is describe the category'
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIUM RECOMMENDATIONS
  // These address specific signal gaps and consistency improvements.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── REC: Sentiment conflict across engines ──
  if (sentimentConflict || (sentimentAlignment < 50 && activeCount >= 2)) {
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.MEDIUM,
      `AI engines give contradictory emotional descriptions of ${domain} — some describe it positively while others describe it negatively or with mixed sentiment`,
      'Conduct a brand narrative audit: identify where negative or mixed AI sentiment originates by searching for the brand on Reddit, Twitter, review sites, and news archives. Address legitimate criticisms publicly and substantively. Amplify positive user stories, testimonials, and case studies across authoritative channels so they outweigh negative signals in AI training data',
      'AI sentiment about a brand is a reflection of the aggregate emotional tone of content about it across the web. Addressing and outweighing negative signals over time shifts the training data balance toward consistent, positive sentiment'
    ));
  }

  // ── REC: Negative dominant sentiment ──
  else if (hasNegativeSentiment && !hasPositiveSentiment) {
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.HIGH,
      EFFORT.HIGH,
      `AI engines describe ${domain} with predominantly negative sentiment — this actively harms brand reputation in AI-generated responses and recommendations`,
      'Implement a structured reputation recovery programme: (1) Identify the top sources of negative AI signal through deep web monitoring. (2) Address root causes publicly — product issues, customer service failures, or PR incidents. (3) Launch a systematic user story collection campaign to generate authentic positive content at scale. (4) Engage positively in communities where the brand has negative reputation',
      'Shifting negative AI sentiment requires sustained, genuine positive signal over 3–6 months of consistent reputation work — but each piece of authentic positive content directly competes with negative signals in AI training pipelines'
    ));
  }

  // ── REC: Viral moments not reflected in AI ──
  if (viralRatio === 0 && overallScore >= 35) {
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `${domain} has had notable moments but AI has no awareness of them — viral launches, community events, or cultural references are not reflected in AI knowledge`,
      'Create dedicated, SEO-optimised content documenting the brand\'s notable moments: launch stories, milestone announcements, community events, or viral products. Ensure these are indexed, interlinked, and referenced from the main Wikipedia/Crunchbase entries so AI systems can find and incorporate them',
      'AI systems learn about brand moments from web content that describes, references, and links to those events. Documented, indexed, well-linked event content is what converts a viral moment from offline memory into AI training signal'
    ));
  }

  // ── REC: Formal knowledge anchoring missing ──
  if (avgFormal < 3.5 && avgInformal >= 5) {
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `${domain} is known informally in AI but lacks factual anchoring — AI cannot verify basic facts like founding year, location, team, or product details`,
      'Establish factual anchors across three high-weight sources: (1) Create or update the Wikipedia entry with cited founding year, headquarters, and key product facts. (2) Complete and verify the Crunchbase profile with all factual fields populated. (3) Ensure the brand\'s own "About" page contains all key facts in structured, crawlable text — not buried in images or JavaScript',
      'Factual anchors in Wikipedia and Crunchbase are among the highest-weight inputs in AI training data. Once these citations exist and are consistent, AI systems use them to upgrade informal community knowledge into verified factual knowledge'
    ));
  }

  // ── REC: Competitive context missing ──
  if (hasGap(narrativeGaps, 'competitive_context')) {
    const competitorTopics = allUnknownTopics.filter(t =>
      t.includes('competitor') || t.includes('alternative') || t.includes('versus')
    );
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `AI cannot place ${domain} in its competitive landscape — engines do not know what alternatives exist or how the brand compares`,
      'Create comparison content that explicitly names the brand alongside its top 3–5 competitors: "[Brand] vs [Competitor]" pages, "Best alternatives to [Category Leader]" articles, and "Why companies switch from [Competitor] to [Brand]" case studies. These are the exact content formats AI systems use to build competitive context knowledge',
      'Comparison and alternative content is a primary source of competitive context in AI training data. Once the brand appears consistently alongside its competitors in comparison content, AI systems learn its competitive position'
    ));
  }

  // ── REC: Audience clarity missing ──
  if (hasGap(narrativeGaps, 'audience_unknown')) {
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `AI does not know who uses ${domain} — engines cannot describe the brand's audience, use cases, or the problems it solves`,
      'Create explicit audience-signal content: a "Who uses [Brand]" page with specific personas and use cases, customer case studies featuring real named users and their outcomes, and testimonials that identify the user\'s role and company type. Ensure the homepage H1 and meta description explicitly state who the brand serves',
      'AI audience knowledge comes directly from the language of customer-facing content. Explicit, varied audience description across multiple indexed pages teaches AI systems who the brand serves'
    ));
  }

  // ── REC: Cross-engine consistency needs improvement ──
  if (consistencyScore >= 30 && consistencyScore < 55 && activeCount >= 2) {
    const topConflict = conflictedTopics[0] || 'brand positioning';
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `AI engines give inconsistent descriptions of ${domain} — key conflict areas: ${topConflict}`,
      'Audit all major public brand profiles (Wikipedia, Crunchbase, LinkedIn, AngelList, G2, Capterra, Google Business) and ensure the brand description, category, and key facts are word-for-word consistent across all of them. Set a quarterly review schedule to keep all profiles synchronised',
      'AI systems resolve conflicting signals by weighting the most consistent version across the most sources. Consistent cross-platform information reduces contradictions in AI responses over time'
    ));
  }

  // ── REC: Narrative appears stale ──
  if (hasGap(narrativeGaps, 'narrative_stale')) {
    recommendations.push(buildRec(
      SEVERITY.MEDIUM,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `AI knowledge of ${domain} appears outdated — engines flag uncertainty about current information and reference potentially stale facts`,
      'Establish a regular "brand signal refresh" cadence: publish a monthly update post or changelog on the main domain, update Wikipedia with recent milestones (with citations), keep Crunchbase and LinkedIn company pages current with latest funding, headcount, and product updates. Date-stamp key content pages so crawlers can prioritise fresh content',
      'AI training pipelines weight recency for fast-changing domains. Regular dated updates to high-authority pages signal that brand information is current and should be prioritised over older cached versions'
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOW RECOMMENDATIONS
  // These are refinements that improve specific signal dimensions once
  // the critical and high gaps are addressed.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── REC: Agreed topics could be leveraged as strengths ──
  if (agreedTopics.length >= 3 && overallScore >= 40) {
    const topicList = agreedTopics.slice(0, 3).join(', ');
    recommendations.push(buildRec(
      SEVERITY.LOW,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `AI engines already agree on ${domain}'s core topics (${topicList}) — these agreed signals represent a foundation to build from`,
      `Deepen the content and signal coverage around the topics where AI already agrees: ${topicList}. Publish detailed, authoritative content specifically on these topics and ensure they are referenced in the brand\'s Wikipedia entry, Crunchbase description, and social media profiles`,
      'Agreed AI topics are already anchored in training data — deepening content around them increases AI depth scores and makes these signals more durable across future model updates'
    ));
  }

  // ── REC: Virality strategy for brands with moderate+ awareness ──
  if (overallScore >= 45 && viralRatio === 0) {
    recommendations.push(buildRec(
      SEVERITY.LOW,
      IMPACT.MEDIUM,
      EFFORT.MEDIUM,
      `${domain} has reasonable AI awareness but no viral or cultural moment signal — missing an opportunity to dramatically amplify recognition`,
      'Design a "cultural moment" content strategy: publish original research or data that your industry will reference, create a tool or resource that is genuinely useful enough to be shared widely, or launch a community initiative that generates organic discussion. Document and amplify the moment across all channels when it happens',
      'A single high-virality moment — a widely-shared dataset, a tool that goes viral on Product Hunt, or a community initiative — can generate more AI training signal in one week than months of regular content output'
    ));
  }

  // ── REC: Informal and formal balance ──
  if (avgInformal >= 6 && avgFormal >= 6 && overallScore < 70) {
    recommendations.push(buildRec(
      SEVERITY.LOW,
      IMPACT.MEDIUM,
      EFFORT.LOW,
      `${domain} has both informal and formal AI knowledge but the overall score is below its potential — integration between the two knowledge layers is incomplete`,
      'Bridge the formal-informal gap: ensure that the brand\'s Wikipedia article references and cites community discussions, user testimonials reference the brand\'s documented facts, and press mentions connect community popularity to verified business metrics. The goal is a web of citations that connects informal reputation to formal facts',
      'AI systems build higher-quality brand knowledge when informal and formal signals reference each other across sources. Integration of the two knowledge layers produces more consistent, higher-confidence AI descriptions'
    ));
  }

  // ── REC: High awareness maintenance ──
  if (overallScore >= 70) {
    recommendations.push(buildRec(
      SEVERITY.LOW,
      IMPACT.LOW,
      EFFORT.LOW,
      `${domain} has strong AI awareness — the primary risk now is signal decay as AI models update and competitors build their own AI presence`,
      'Implement a quarterly AI awareness monitoring programme: re-scan the brand every 90 days, track score changes across all dimensions, and set up Google Alerts and Brand24/Mention monitoring for brand name mentions across the web. When scores dip on any dimension, address within 30 days',
      'Strong AI awareness is not permanent — it requires ongoing maintenance as models retrain and new content displaces old signals. Monitoring ensures early detection of any dimension that begins to decay'
    ));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SORT: critical → high → medium → low
  // Deduplicate by problem string similarity to prevent near-identical recs
  // Cap at 8 for display
  // ─────────────────────────────────────────────────────────────────────────
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  const sorted = [...recommendations].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  // Deduplicate: skip recs whose problem statement is more than 80% similar
  // to an already-included rec (prevents near-duplicate recs for similar gaps)
  const finalRecs = [];
  const includedProblems = [];

  for (const rec of sorted) {
    const isDuplicate = includedProblems.some(existing => {
      const wordsNew      = rec.problem.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const wordsExisting = existing.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const shared = wordsNew.filter(w => wordsExisting.includes(w));
      const similarity = wordsNew.length > 0 ? shared.length / wordsNew.length : 0;
      return similarity > 0.7;
    });

    if (!isDuplicate) {
      finalRecs.push(rec);
      includedProblems.push(rec.problem);
    }

    if (finalRecs.length >= 8) break;
  }

  logger.info(
    `Recommendations complete — ${finalRecs.length} generated | ` +
    `critical: ${finalRecs.filter(r => r.severity === SEVERITY.CRITICAL).length} | ` +
    `high: ${finalRecs.filter(r => r.severity === SEVERITY.HIGH).length} | ` +
    `medium: ${finalRecs.filter(r => r.severity === SEVERITY.MEDIUM).length} | ` +
    `low: ${finalRecs.filter(r => r.severity === SEVERITY.LOW).length}`
  );

  return finalRecs;
}

module.exports = {
  generateRecommendations,
  // Exported for unit testing
  buildRec,
  hasGap,
  getGap,
  SEVERITY,
  IMPACT,
  EFFORT
};
