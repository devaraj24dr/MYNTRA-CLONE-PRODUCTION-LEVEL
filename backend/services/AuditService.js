const AuditLog = require("../models/AuditLog");

class AuditService {
  /**
   * Records a transaction state transition in the AuditLog collection.
   * @param {string} action - Action identifier (e.g. 'Payment Success').
   * @param {string} transactionId - MongoDB Transaction ID.
   * @param {string} userId - MongoDB User ID.
   * @param {object} metadata - Extra context information.
   * @param {object} req - Express Request object to capture IP and User-Agent.
   */
  static async log(action, transactionId, userId, metadata = {}, req = null) {
    try {
      let ipAddress = "";
      let userAgent = "";

      if (req) {
        ipAddress =
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress ||
          req.ip ||
          "";
        userAgent = req.headers["user-agent"] || "";
      }

      await AuditLog.create({
        userId: userId || null,
        transactionId,
        action,
        ipAddress,
        userAgent,
        metadata,
      });

      console.log(`[AuditService] 📝 Logged action "${action}" for transaction ${transactionId}`);
    } catch (error) {
      console.error("[AuditService] Failed to write audit log:", error);
    }
  }
}

module.exports = AuditService;
