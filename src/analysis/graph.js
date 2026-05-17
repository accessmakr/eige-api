'use strict';

const { getAllCoOccurrences } = require('../db/cooccurrence');
const logger = require('../utils/logger');

const CATEGORY_COLORS = {
  'JavaScript Framework': '#4F8EF7',
  'CMS': '#48BB78',
  'CDN': '#38B2AC',
  'Hosting': '#9F7AEA',
  'CSS Framework': '#ED8936',
  'Analytics': '#F6AD55',
  'Tag Manager': '#F6AD55',
  'E-Commerce': '#FC8181',
  'Payment': '#F687B3',
  'Security': '#FC8181',
  'Customer Support': '#76E4F7',
  'Marketing': '#B794F4',
  'A/B Testing': '#FBD38D',
  'Search': '#90CDF4',
  'Database': '#68D391',
  'Font': '#CBD5E0',
  'Map': '#81E6D9',
  'Video': '#FEB2B2',
  'Monitoring': '#F6AD55',
  'Web Server': '#A0AEC0',
  'Programming Language': '#B794F4',
  'default': '#718096'
};

function getNodeColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['default'];
}

function buildPerScanGraph(technologies) {
  try {
    if (!technologies || technologies.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodes = technologies.map(tech => ({
      id: tech.name,
      label: tech.name,
      category: tech.category,
      weight: tech.confidence,
      color: getNodeColor(tech.category),
      size: Math.max(8, Math.round(tech.confidence * 20))
    }));

    const edges = [];
    for (let i = 0; i < technologies.length; i++) {
      for (let j = i + 1; j < technologies.length; j++) {
        const techA = technologies[i];
        const techB = technologies[j];

        const sameCategory = techA.category === techB.category;
        const baseWeight = (techA.confidence + techB.confidence) / 2;
        const categoryBonus = sameCategory ? 0.1 : 0;
        const edgeWeight = parseFloat(Math.min(baseWeight + categoryBonus, 1.0).toFixed(3));

        if (edgeWeight >= 0.3) {
          edges.push({
            source: techA.name,
            target: techB.name,
            weight: edgeWeight,
            sameCategory
          });
        }
      }
    }

    edges.sort((a, b) => b.weight - a.weight);
    const topEdges = edges.slice(0, 100);

    logger.info(`Per-scan graph built — ${nodes.length} nodes, ${topEdges.length} edges`);

    return { nodes, edges: topEdges };

  } catch (err) {
    logger.error(`Per-scan graph build failed: ${err.message}`);
    return { nodes: [], edges: [] };
  }
}

async function buildGlobalGraph() {
  try {
    logger.info('Building global co-occurrence graph');

    const coOccurrences = await getAllCoOccurrences();

    if (!coOccurrences || coOccurrences.length === 0) {
      logger.warn('No co-occurrence data available for global graph');
      return { nodes: [], edges: [] };
    }

    const nodeMap = new Map();

    for (const pair of coOccurrences) {
      if (!nodeMap.has(pair.tech_a)) {
        nodeMap.set(pair.tech_a, {
          id: pair.tech_a,
          label: pair.tech_a,
          category: pair.category_a || 'Unknown',
          weight: pair.weight,
          color: getNodeColor(pair.category_a || 'Unknown'),
          size: Math.max(8, Math.round(pair.weight * 20))
        });
      } else {
        const existing = nodeMap.get(pair.tech_a);
        existing.weight = Math.max(existing.weight, pair.weight);
        existing.size = Math.max(8, Math.round(existing.weight * 20));
      }

      if (!nodeMap.has(pair.tech_b)) {
        nodeMap.set(pair.tech_b, {
          id: pair.tech_b,
          label: pair.tech_b,
          category: pair.category_b || 'Unknown',
          weight: pair.weight,
          color: getNodeColor(pair.category_b || 'Unknown'),
          size: Math.max(8, Math.round(pair.weight * 20))
        });
      } else {
        const existing = nodeMap.get(pair.tech_b);
        existing.weight = Math.max(existing.weight, pair.weight);
        existing.size = Math.max(8, Math.round(existing.weight * 20));
      }
    }

    const nodes = Array.from(nodeMap.values());

    const edges = coOccurrences
      .filter(pair => pair.weight >= 0.05)
      .slice(0, 300)
      .map(pair => ({
        source: pair.tech_a,
        target: pair.tech_b,
        weight: pair.weight,
        count: pair.count
      }));

    logger.info(`Global graph built — ${nodes.length} nodes, ${edges.length} edges`);

    return { nodes, edges };

  } catch (err) {
    logger.error(`Global graph build failed: ${err.message}`);
    return { nodes: [], edges: [] };
  }
}

function enrichGraphWithClusters(graph, clusterResult) {
  if (!clusterResult || !clusterResult.id || clusterResult.id === 'unknown') {
    return graph;
  }

  const enrichedNodes = graph.nodes.map(node => ({
    ...node,
    cluster: clusterResult.id,
    clusterName: clusterResult.name
  }));

  return { ...graph, nodes: enrichedNodes, clusterName: clusterResult.name };
}

module.exports = {
  buildPerScanGraph,
  buildGlobalGraph,
  enrichGraphWithClusters,
  getNodeColor
};
