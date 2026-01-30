export const daeFilter = (req, res, next) => {
  const { gte, lte } = req.query;
  const dateFilter = {};

  if (gte) dateFilter.$gte = new Date(gte);
  if (lte) dateFilter.$lte = new Date(lte);

  req.dateFilter = dateFilter;

  next();
};
