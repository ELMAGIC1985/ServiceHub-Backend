import { Service } from '../../models/service.model.js'

export const createService = async (vendorId, data) => {
    data.vendor = vendorId
    return await Service.create(data)
}

export const editService = async (serviceId, vendorId, data) => {
    return await Service.findOneAndUpdate(
        { _id: serviceId, vendor: vendorId },
        data,
        { new: true }
    )
}

export const deleteService = async (serviceId, vendorId) => {
    await Service.findOneAndDelete({ _id: serviceId, vendor: vendorId })
}

export const getServiceList = async (vendorId) => {
    return await Service.find({
        vendor: vendorId
    })
}

export const getServicesById = async (serviceId, vendorId) => {
    return Service.findById({
        _id: serviceId,
        vendor: vendorId
    })
}
