import { Product } from '../../models/product.model.js'
import { Service } from '../../models/service.model.js'

export const addProduct = async (data) => {
    return await Product.create(data)
}

export const editProduct = async (productId, data) => {
    return await Product.findByIdAndUpdate(productId, data, { new: true })
}

export const deleteProduct = async (productId) => {
    await Product.findByIdAndDelete(productId)
}

export const getProductList = async () => {
    return await Product.find()
}

export const getProductById = async (productId) => {
    return Product.findById(productId)
}

export const addVendorService = async (data) => {
    return await Service.create(data)
}

export const editVendorService = async (serviceId, data) => {
    return await Service.findByIdAndUpdate(serviceId, data, { new: true })
}

export const deleteVendorService = async (serviceId) => {
    await Service.findByIdAndDelete(serviceId)
}

export const getServiceList = async () => {
    return await Service.find()
}

export const getServicesById = async (serviceId, vendorId) => {
    return Service.findById({
        _id: serviceId
    })
}
