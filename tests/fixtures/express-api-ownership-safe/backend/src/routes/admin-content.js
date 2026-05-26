const express = require("express");
const { authMiddleware, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.patch("/admin/content/:id", authMiddleware, requireAdmin, async (req, res) => {
  const content = await req.app.locals.db.content.update({
    id: req.params.id,
    body: req.body.body
  });

  res.json({ content });
});

module.exports = router;
