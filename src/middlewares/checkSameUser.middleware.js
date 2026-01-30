import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const checkSameUser = (key = null) =>
  asyncHandler(async (req, res, next) => {
    let id = req.params.id;

    if (key) {
      id = req.body[key];
    }

    if (req.user.role === 'admin') {
      return next();
    }

    console.log(req.user._id, id);

    if (req.user._id.toString() !== id) {
      return res.status(401).json(new ApiResponse(401, null, 'Unauthorized request'));
    }

    next();
  });
