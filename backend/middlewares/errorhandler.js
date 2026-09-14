const errorHandler = (err, req, res, next) => {
  console.error(err);

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    return res.status(statusCode).json({
      message: "Internal server error",
    });
  }

  return res.status(statusCode).json({
    message: err.message || "Request failed",
  });
};

export default errorHandler;
