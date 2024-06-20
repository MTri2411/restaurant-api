const express = require("express");
const tableController = require("../controllers/tableController");
const categoryRoutes = require("../routes/categoryRoutes");

const router = express.Router();

router
  .route("/")
  .get(tableController.getTables)
  .post(tableController.createTable);

router
  .route("/:tableId")
  .get(tableController.checkStatusTable)
  .post(tableController.createQRcode)
  .patch(tableController.updateTable)
  .delete(tableController.softDeleteTable);

router.route("/hd/:tableId").delete(tableController.hardDeleteTable);

router
  .route("/update-status/:tableId")
  .patch(tableController.updateStatusTable);

module.exports = router;
