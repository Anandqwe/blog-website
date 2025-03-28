import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Animalwrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { getDay } from "../common/date";
import BlogInteraction from "../components/bloginteraction.component";
import BlogPostCard from "../components/blogcard.component";
import BlogContent from "../components/blogcontent.component";


export const blogStructure = {
  title: "",
  des: "",
  content: [],
  author: { personal_info: {} },
  banner: "",
  publishedAt: "",
};

export const BlogContext = createContext({});

const BlogPage = () => {
  let { blog_id } = useParams();
  const [blog, setBlog] = useState(blogStructure);
  const [loading, setLoading] = useState(true);
  const [similarBlogs, setSimilarBlogs] = useState([]);
  const [islikedByUser,setLikedByUser] = useState(false);

  let {
    title,
    content,
    banner,
    author: {
      personal_info: { fullname, username: author_username, profile_img },
    },
    publishedAt,
  } = blog;

  const fetchBlog = () => {
    axios
      .post(import.meta.env.VITE_SERVER_HOST + "/get-blog", { blog_id })
      .then(({ data: { blog } }) => {
        axios
          .post(import.meta.env.VITE_SERVER_HOST + "/search-blogs", {
            tag: blog.tags[0],
            limit: 6,
            eliminate_blog: blog_id,
          })
          .then(({ data }) => {
            setSimilarBlogs(data.blogs);
          });
        setBlog(blog);
        console.log(blog);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching blog:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    resetstates();
    fetchBlog();
  }, [blog_id]);

  const resetstates = () => {
    setBlog(blogStructure);
    setLoading(true);
    setSimilarBlogs([]);
  };

  return (
    <div>
      <Animalwrapper>
        {loading ? (
          <Loader />
        ) : (
          <BlogContext.Provider value={{ blog, setBlog,islikedByUser,setLikedByUser}}>
            <div className="max-w-[900px] center py-10 max-lg:px-[5vw]">
              <img src={banner} className="aspect-video" />
              <div className="mt-12">
                <h2>{title}</h2>
                <div className="flex max-sm:flex-col justify-between my-8">
                  <div className="flex gap-5 items-start">
                    <img
                      src={profile_img}
                      alt="user profile"
                      className="w-12 h-12 rounded-full"
                    />
                    <p className="capitalize">
                      {fullname}
                      <br />@
                      <Link
                        to={`/user/${author_username}`}
                        className="underline"
                      >
                        {author_username}
                      </Link>
                    </p>
                  </div>
                  <p className="text-dark-grey opacity-75 max-sm:ml-12 max-sm:pl-5">
                    Published on {getDay(publishedAt)}
                  </p>
                </div>
              </div>

              <BlogInteraction />

                <div className="my-12 font-gelasio blog-page-content">
                    {
                        content[0].blocks.map((block, i) => {
                            return <div key={i} className="my-4 md:my-8">
                                <BlogContent block={block}/>
                            </div>
                        })
                    }
                </div>
             
              <BlogInteraction />
              {similarBlogs != null && similarBlogs.length ? (
                <>
                  <h1 className="text-2xl mt-14 mb-10 font-medium">
                    Similar Blogs
                  </h1>
                  {similarBlogs.map((blog, i) => {
                    let {
                      author: { personal_info },
                    } = blog;
                    return (
                      <Animalwrapper
                        key={i}
                        transition={{ duration: 1, delay: i * 0.08 }}
                      >
                        <BlogPostCard content={blog} author={personal_info} />
                      </Animalwrapper>
                    );
                  })}
                </>
              ) : (
                " "
              )}
            </div>
          </BlogContext.Provider>
        )}
      </Animalwrapper>
    </div>
  );
};
export default BlogPage;
