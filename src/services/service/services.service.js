import { Service } from '../../models/service.model.js'
import { Category } from '../../models/category.model.js'

const addService = async (data) => {
    return await Service.create(data)
}

const editService = async (serviceId, userId, data) => {
    return await Service.findByIdAndUpdate(
        {
            _id: serviceId,
            vendor: userId
        },
        data,
        {
            new: true
        }
    )
}

const deleteService = async (serviceId, userId) => {
    await Service.findByIdAndDelete({
        _id: serviceId,
        vendor: userId
    })
}

const getServiceList = async () => {
    return await Service.find()
        .populate({
            path: 'serviceCategory',
            select: 'name _id'
        })
        .populate({
            path: 'vendor',
            select: 'firstName middleName lastName _id',
            transform: (doc) => {
                if (!doc) return null
                const fullName = [doc.firstName, doc.middleName, doc.lastName]
                    .filter(Boolean)
                    .join(' ')
                return { _id: doc._id, name: fullName }
            }
        })
}

const getServicesById = async (serviceId) => {
    return Service.findById({
        _id: serviceId
    })
}

export {
    addService,
    editService,
    deleteService,
    getServiceList,
    getServicesById
}
