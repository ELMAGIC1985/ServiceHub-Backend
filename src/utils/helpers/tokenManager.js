import bcrypt from 'bcrypt';
import crypto from 'crypto';

import Token from '../../models/token.model.js';

const createToken = async (entityId, entityType, tokenType, value, expiryTime = 3600000) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = await bcrypt.hash(rawToken, 10);

  await Token.findOneAndDelete({
    entityId,
    entityType,
    tokenType,
  });

  const tokenDocument = await new Token({
    entityId,
    entityType,
    tokenType,
    token: hashedToken,
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiryTime,
  }).save();

  return {
    rawToken, // Send to user (via email link, etc.)
    hashedToken, // Stored in DB
    tokenDocument, // The full token document (if needed)
  };
};

const verifyToken = async (entityId, entityType, token, tokenType) => {
  const tokenDoc = await Token.findOne({
    entityId,
    entityType,
    tokenType,
  });

  if (!tokenDoc) {
    return false;
  }

  if (tokenDoc.expiresAt < Date.now()) {
    await Token.findByIdAndDelete(tokenDoc._id);
    return false;
  }

  const isValid = await bcrypt.compare(token, tokenDoc.token);
  if (!isValid) {
    return false;
  }

  return tokenDoc;
};

const removeToken = async (entityId, entityType, tokenType) => {
  await Token.findOneAndDelete({
    entityId,
    entityType,
    tokenType,
  });
};

export { createToken, verifyToken, removeToken };
