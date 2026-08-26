const errorHandler = (err, req, res, next) => {
  console.log(err);

  const statusCode = err.statusCode || 500;

  return res
    .status(statusCode)
    .json({ message: err.message || "internal server error" });
};

export default errorHandler;
