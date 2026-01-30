import Category from '../../models/category.model.js'

const addServiceCategory = async (data) => {
    return await Category.create(data)
}

const getAllServiceCategoryList = async () => {
    return await Category.find()
}

const deleteCategoryById = async (categoryId) => {
    await Category.findByIdAndDelete(categoryId)
}

export { addServiceCategory, getAllServiceCategoryList, deleteCategoryById }
