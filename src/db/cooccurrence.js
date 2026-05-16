'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

async function incrementCoOccurrence(technologies) {
  try {
    if (!technologies || technologies.length < 2) return;

    const pairs = [];
    for (let i = 0; i < technologies.length; i++) {
      for (let j = i + 1; j < technologies.length; j++) {
        const techA = technologies[i].name < technologies[j].name
          ? technologies[i].name
          : technologies[j].name;
        const techB = technologies[i].name < technologies[j].name
          ? technologies[j].name
          : technologies[i].name;
        const categoryA = technologies[i].name < technologies[j].name
          ? technologies[i].category
          : technologies[j].category;
        const categoryB = technologies[i].name < technologies[j].name
          ? technologies[j].category
          : technologies[i].category;

        pairs.push({ techA, techB, categoryA, categoryB });
      }
    }

    for (const pair of pairs) {
      const { data: existing } = await supabase
        .from('co_occurrence')
        .select('id, count')
        .eq('tech_a', pair.techA)
        .eq('tech_b', pair.techB)
        .single();

      if (existing) {
        await supabase
          .from('co_occurrence')
          .update({
            count: existing.count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('co_occurrence')
          .insert({
            tech_a: pair.techA,
            tech_b: pair.techB,
            category_a: pair.categoryA,
            category_b: pair.categoryB,
            count: 1,
            weight: 0.1,
            updated_at: new Date().toISOString()
          });
      }
    }

    await normaliseWeights();
    logger.info(`Co-occurrence updated for ${pairs.length} technology pairs`);

  } catch (err) {
    logger.warn(`Co-occurrence update error: ${err.message}`);
  }
}

async function normaliseWeights() {
  try {
    const { data: allPairs } = await supabase
      .from('co_occurrence')
      .select('id, count');

    if (!allPairs || allPairs.length === 0) return;

    const maxCount = Math.max(...allPairs.map(p => p.count));
    if (maxCount === 0) return;

    for (const pair of allPairs) {
      const weight = parseFloat((pair.count / maxCount).toFixed(4));
      await supabase
        .from('co_occurrence')
        .update({ weight })
        .eq('id', pair.id);
    }

    logger.info('Co-occurrence weights normalised');

  } catch (err) {
    logger.warn(`Weight normalisation error: ${err.message}`);
  }
}

async function getAllCoOccurrences() {
  try {
    const { data, error } = await supabase
      .from('co_occurrence')
      .select('*')
      .order('weight', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];

  } catch (err) {
    logger.warn(`Failed to fetch co-occurrences: ${err.message}`);
    return [];
  }
}

async function getCoOccurrenceStats() {
  try {
    const { count: totalEdges } = await supabase
      .from('co_occurrence')
      .select('*', { count: 'exact', head: true });

    const { data: techData } = await supabase
      .from('co_occurrence')
      .select('tech_a, tech_b');

    const uniqueTechs = new Set();
    if (techData) {
      techData.forEach(row => {
        uniqueTechs.add(row.tech_a);
        uniqueTechs.add(row.tech_b);
      });
    }

    return {
      totalNodes: uniqueTechs.size,
      totalEdges: totalEdges || 0
    };

  } catch (err) {
    logger.warn(`Co-occurrence stats error: ${err.message}`);
    return { totalNodes: 0, totalEdges: 0 };
  }
}

module.exports = {
  incrementCoOccurrence,
  getAllCoOccurrences,
  getCoOccurrenceStats
};
