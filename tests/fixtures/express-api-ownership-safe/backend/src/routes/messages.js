const express = require("express");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/messages/:id", authMiddleware, async (req, res) => {
  const message = await req.app.locals.db.messages.findFirst({
    where: {
      id: req.params.id,
      userId: req.userId
    }
  });

  res.json({ message });
});

module.exports = router;
