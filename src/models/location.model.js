const mongoose = require('mongoose')

const locationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }, // Associating with a user
    locations: [
        {
            //  each location has a unique ID
            address: { type: String, required: true },
            pinCode: { type: String, required: true }
        }
    ]
})

const Location = mongoose.model('Location', locationSchema)

export default Location
