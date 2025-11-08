import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

// Create short-lived Access Token
export const createAccessToken = (payload) =>{
    return jwt.sign(payload,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:"7d"
    })
}

// Create long-lived Refresh Token
export const createRefreshToken = (payload) => {
    return jwt.sign(payload,process.env.REFRESH_TOKEN_SECRET,{
        expiresIn:"7d"
    })
}