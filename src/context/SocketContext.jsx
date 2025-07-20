import { createContext, useContext, useRef, useEffect } from "react";
import {io} from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext= createContext();

export const SocketProvider= ({children})=>{
    const {user}= useAuth();
    const socket= useRef();
    
    useEffect(()=>{
        if(user){
            socket.current= io(import.meta.env.VITE_SERVER_URL || "https://talksync-kvsb.onrender.com");
            socket.current.emit("setup", user);
        }
        return ()=>{
            if(socket.current) socket.current.disconnect();
        };

   }, [user]);



   return (
    <SocketContext.Provider value={socket}>
        {children}
    </SocketContext.Provider>
);

};

export const useSocket= ()=>useContext(SocketContext);