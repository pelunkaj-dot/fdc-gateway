// /api/health.js — jednoduché "žije to?"
module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    env: {
      catalogUrlSeen: Boolean(process.env.CATALOG_URL),
      rawBaseSeen: Boolean(process.env.REPO_RAW_BASE)
    }
  });
};

