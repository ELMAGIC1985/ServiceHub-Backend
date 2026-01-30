export default (res, responseStatusCode, responseMessage, data = null) => {
    const response = {
        success: true,
        statusCode: responseStatusCode,
        message: responseMessage,
        data: data
    }

    res.status(responseStatusCode).json(response)
}
