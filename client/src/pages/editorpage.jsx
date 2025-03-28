import { createContext, useContext, useEffect, useState } from "react";
import { UserContext } from "../App";
import { Navigate, useParams } from "react-router-dom";
import BlogEditor from "../components/blogeditor.component.jsx";
import PublishForm from "../components/publishform.component";
import Loader from "../components/loader.component.jsx";
import axios from "axios";

const blogStructure = {
  title: "",
  banner: "",
  content: [],
  tags: [],
  des: "",
  author: { personal_info: {} },
};

export const Editorcontext = createContext({});

const Editor = () => {

  let {blog_id} = useParams();

  const [blog, setBlog] = useState(blogStructure);
  const [Editorstate, setEditorState] = useState("editor");
  const [textEditor, setTextEditor] = useState({isReady: false});
  const [loading, setLoading] = useState(true);

  let {
    userAuth: { access_token },
  } = useContext(UserContext);

  useEffect(() => {
    if(!blog_id){
      return setLoading(false);
    }

    axios.post(import.meta.env.VITE_SERVER_HOST + "/get-blog",{blog_id,draft:true,mode : 'edit'})
    .then(({data:{blog}})=>{
      setBlog(blog);
      setLoading(false);
    }).catch(err=>{
      setBlog(null);
      setLoading(false);
    });
  },[]);

  return (
    <Editorcontext.Provider value={{blog, setBlog,Editorstate, setEditorState,textEditor, setTextEditor}}>
    
      {access_token === null ? (
        <Navigate to="/signin" />
      ) : 
      loading ? <Loader /> :
      Editorstate == "editor" ? (
        <BlogEditor token={access_token} />
      ) : (
        <PublishForm />
      )}
    </Editorcontext.Provider>
  );
};

export default Editor;
