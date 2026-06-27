import jwt from "jsonwebtoken"

export const isAuth = async (req,res,next) => {
    try {
        const token = req.cookies.token

        if(!token){
            // No token provided, but don't block - allow public access
            req.userId = null
            return next()
        }

        const verifyToken = jwt.verify(token ,process.env.JWT_SECRET)
        if(!verifyToken){
            req.userId = null
            return next()
        }
        req.userId = verifyToken.userId
        next()
    } catch (error) {
            console.log(error)
            // Don't block on error, allow public access
            req.userId = null
            next()
    }
}