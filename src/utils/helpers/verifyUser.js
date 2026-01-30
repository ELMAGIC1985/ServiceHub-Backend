import mongoose from 'mongoose'

export const checkSameUser = (req, id) => {
    try {
        return new mongoose.Types.ObjectId(id).equals(req?.user?._id)
    } catch (error) {
        console.error('Error comparing user IDs:', error)
        return false
    }
}
