const applyDateFilter = (req, res, next) => {
  const query = {};

  if (req.query && Object.keys(req.query).length > 0) {
    query.createdAt = {
      $gte: new Date(req.query.gte),
      $lte: new Date(req.query.lte),
    };
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  req.query = query;

  next();
};

export default applyDateFilter;
