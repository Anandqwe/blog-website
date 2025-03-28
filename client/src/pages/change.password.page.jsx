import { useRef,useContext } from "react";
import Animalwrapper from "../common/page-animation";
import InputBox from "../components/input";
import {toast,Toaster} from "react-hot-toast";
import {UserContext} from "../App";
import axios from "axios";



const ChangePassword = () => {

    let {userAuth:{access_token}} = useContext(UserContext);
   
    let changePasswordForm = useRef();

    let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;

    const handleSubmit = (e) => {
        e.preventDefault();
        let form = new FormData(changePasswordForm.current);
        let formData = {};

        for(let [key,value] of form.entries()){
            formData[key] = value;
        }

        let {currentPassword,newPassword} = formData;
        if(!currentPassword.length || !newPassword.length){
            return toast.error("Please fill all fields");
        }

        if(!passwordRegex.test(newPassword) || !passwordRegex.test(currentPassword)){
            return toast.error("Password should be 6-20 characters long, include at least one uppercase letter, one lowercase letter, and one numeric digit");
        }

        e.target.setAttribute("disabled",true);

        let loadingToast = toast.loading("Changing Password");

        axios.post(import.meta.env.VITE_SERVER_HOST + "/change-password",formData,{
            headers:{
                'Authorization': `bearer ${access_token}`
            }
        }) 
        .then(() => {
            toast.dismiss(loadingToast);
            e.target.removeAttribute("disabled");
            return toast.success("Password Changed Successfully");

        })
        .catch(({response})=>{
            toast.dismiss(loadingToast);
            e.target.removeAttribute("disabled");
            return toast.error(response.data.error);
        })
    }
    return(
        <Animalwrapper>
            <Toaster />
            <form ref={changePasswordForm}>

                <h1 className="max-md:hidden">Change Password</h1>

                <div className="py-10 w-full md-max:w-[400px]">
                    <InputBox name="currentPassword" type="password" className ="profile-edit-input" 
                    placeholder="Current Passowrd" icon="fi fi-rr-unlock" />
                    <InputBox name="newPassword" type="password" className ="profile-edit-input" 
                    placeholder="New Passowrd" icon="fi fi-rr-unlock"/>

                    <button onClick={handleSubmit} className="btn-dark px-10 mt-10" type="submit">Change Password</button>
                </div>
                
            </form>
        </Animalwrapper>
    )
}
export default ChangePassword;