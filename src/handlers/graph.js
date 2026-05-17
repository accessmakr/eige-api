'use strict';

const { buildGlobalGraph } = require('../analysis/graph');
const { getCached, setCached } = require('../db/cache');
const logger = require('../utils/logger');

async function graphHandler(req, res) {
  const t0 = Date.now();

  logger.info('Global graph request received');

  try {
    const cacheKey = 'global:graph';

    const cached = await getCached(cacheKey);
    if (cached) {
      logger.info('Cache HIT for global graph');
      return res.status(200).json({
        ...cached,
        cached: true,
        latency: Date.now() - t0
      });
    }

    const graph = await buildGlobalGraph();

    const latency = Date.now() - t0;
    const timestamp = Date.now();

    const nodeCategories = {};
    for (const node of graph.nodes) {
      if (!nodeCategories[node.category]) {
        nodeCategories[node.category] = 0;
      }
      nodeCategories[node.category]++;
    }

    const topTechnologies = [...graph.nodes]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map(n => ({
        name: n.id,
        category: n.category,
        weight: n.weight
      }));

    const topConnections = [...graph.edges]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map(e => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        count: e.count
      }));

    const response = {
      mode: 'graph',
      latency,
      cached: false,
      timestamp,
      nodes: graph.nodes,
      edges: graph.edges,
      stats: {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        nodeCategories,
        topTechnologies,
        topConnections
      }
    };

    setCached(cacheKey, response).catch(err => {
      logger.warn(`Global graph cache save error: ${err.message}`);
    });

    logger.info(`Global graph served — ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${latency}ms`);

    return res.status(200).json(response);

  } catch (err) {
    logger.error(`Graph handler error: ${err.message}`);
    return res.status(500).json({
      error: `Global graph failed — ${err.message}`
    });
  }
}

module.exports = graphHandler;
