import mongoose from "mongoose"

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URL)
        console.log("DB Connected")
        return conn
    } catch (error) {
        console.error("DB Connection Error:", error.message)
        console.error("Full error:", error)
        // Don't exit - let server start but log the error
        // Requests will fail with proper error messages
    }
}

export default connectDB