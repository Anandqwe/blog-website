import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../App";
import axios from "axios";
import { profileDataStructure } from "./profilepage";
import Animalwrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { Toaster,toast } from "react-hot-toast";
import InputBox from "../components/input";
import { storeInSession } from "../common/session";

const EditProfile = () => {
  let {
    userAuth,
    userAuth: { access_token },setUserAuth
  } = useContext(UserContext);

  let bioLimit = 150;
  let profileImgele = useRef();
  let editProfileForm = useRef();

  const [profile, setProfile] = useState(profileDataStructure);
  const [loading, setLoading] = useState(true);
  const [charactersLeft, setCharactersLeft] = useState(bioLimit);

  const [updatedProfileImg, setUpdatedProfileImg] = useState(null);

  let {
    personal_info: {
      fullname,
      username: profile_username,
      profile_img,
      email,
      bio,
    },
    social_links,
  } = profile;

  const handleCharacterChange = (e) => {
    setCharactersLeft(bioLimit - e.target.value.length);
  };

  const handleImagePreview = (e) => {
    let img = e.target.files[0];

    profileImgele.current.src = URL.createObjectURL(img);

    setUpdatedProfileImg(img);
  }

  const handleUploadImg = (e) => {
  e.preventDefault();

  if(updatedProfileImg) {
    let loadingToast = toast.loading("Uploading Image");
    e.target.setAttribute("disabled", true);

    // Create FormData object to send the image
    const formData = new FormData();
    formData.append("profile_img", updatedProfileImg);

    // Send request to your backend
    axios.post(
      import.meta.env.VITE_SERVER_HOST + "/upload-profile-image", 
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${access_token}`
        }
      }
    )
    .then(({data})=>{
        let newUserAuth = {...userAuth,profile_img:data.profile_img};

        storeInSession("user",JSON.stringify(newUserAuth));
        setUserAuth(newUserAuth);

        setUpdatedProfileImg(null);

        toast.dismiss(loadingToast);
        e.target.removeAttribute("disabled");
        toast.success("Image is Uploaded 👍");
    })
    .catch(({response})=>{
        toast.dismiss(loadingToast);
        e.target.removeAttribute("disabled");
        toast.error(response.data.error);
    })
  }
}

  const handleSubmit =(e)=>{
    e.preventDefault();

    let form = new FormData(editProfileForm.current);
    let formData = {};

    for(let [key,value] of form.entries()){
      formData[key] = value;
    }

    let {username,bio,youtube,facebook,instagram,twitter,website,github} = formData;

    if(username.length < 3){
        return toast.error("username must be atleast 3 characters long");
    }
    if(bio.length > bioLimit){
        return toast.error(`Bio should not be more than ${bioLimit} characters`);
    }

    let loadingToast = toast.loading("Updating Profile");
    e.target.setAttribute("disabled",true);

    axios.post(import.meta.env.VITE_SERVER_HOST + "/update-profile",{username,bio,social_links:{youtube,facebook,instagram,twitter,website,github}},{headers:{
        Authorization: `Bearer ${access_token}`
    }}).then(({data})=>{
        if(userAuth.username != data.username){
            let newUserAuth = {...userAuth,username:data.username};
            storeInSession("user",JSON.stringify(newUserAuth));
            setUserAuth(newUserAuth);
        }

        toast.dismiss(loadingToast);
        e.target.removeAttribute("disabled");
        toast.success("Profile Updated 👍");
    })
    .catch(({response})=>{
        toast.dismiss(loadingToast);
        e.target.removeAttribute("disabled");
        toast.error(response.data.error);
    })

}


useEffect(() => {
    if (access_token) {
      axios
        .post(import.meta.env.VITE_SERVER_HOST + "/get-profile", {
          username: userAuth.username,
        })
        .then(({ data }) => {
          setProfile(data);
          setLoading(false);
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }, [access_token]);

  return (
    <Animalwrapper>
      {loading ? (
        <Loader />
      ) : (
        <form className="max-w-4xl mx-auto p-3" ref={editProfileForm}>
          <Toaster />
          <h1 className="text-2xl font-semibold text-center mb-6">
            Edit Profile
          </h1>

          <div className="flex flex-col lg:flex-row items-start gap-10">
            <div className="flex flex-col items-center">
              <label
                htmlFor="uploadImg"
                className="relative w-40 h-40 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
              >
                {profile_img ? (
                  <img
                    ref={profileImgele}
                    src={profile_img}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <p className="text-center text-gray-500 mt-16">No Image</p>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 hover:opacity-100">
                  Upload Image
                </div>
              </label>

              <input
                type="file"
                id="uploadImg"
                accept=".jpeg, .png, .jpg"
                hidden onChange={handleImagePreview}
              />
              <button className="btn-light mt-4 max-lg:center lg:w-full px-10" onClick={handleUploadImg}>
                Upload
              </button>
            </div>

            <div className="w-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputBox
                  name="fullname"
                  type="text"
                  value={fullname}
                  placeholder="Full Name"
                  disabled={true}
                  icon="fi fi-rr-user"
                />
                <InputBox
                  name="email"
                  type="email"
                  value={email}
                  placeholder="Email"
                  disabled={true}
                  icon="fi fi-rr-envelope"
                />
              </div>

              <div>
                <InputBox
                  type="text"
                  name="username"
                  value={profile_username}
                  placeholder="Username"
                  icon="fi-rr-at"
                />
                <p className="text-gray-500 text-sm mt-1">
                  Your username will be visible to all users.
                </p>
              </div>

              {/* bioinfo */}
              <div>
                <textarea
                  name="bio"
                  maxLength={bioLimit}
                  defaultValue={bio}
                  className="w-full h-28 border rounded-md p-3 text-gray-700 resize-none bg-white"
                  placeholder="Write something about yourself..."
                  onChange={handleCharacterChange}
                ></textarea>
                <p className="text-right text-gray-500 text-sm mt-1">
                  {charactersLeft} characters left
                </p>
              </div>

              <p className="text-lg font-medium text-gray-700">
                Social Media Links
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {
                Object.keys(social_links).map((key, i) => {
                   return <InputBox
                    key={i}
                    name={key}
                    type="text"
                    value={social_links[key]}
                    placeholder="https://" icon={"fi " +
                  (key != "website" ? "fi-brands-" + key : "fi-rr-globe")}
                    />
                })
                }
              </div>

              <button className="btn-dark w-auto px-10" type="submit" onClick={handleSubmit}>
                Update
              </button>

            </div>
          </div>
        </form>
      )}
    </Animalwrapper>
  );
};

export default EditProfile;
