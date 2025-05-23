import React, { useContext, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Animalwrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import AboutUser from "../components/about.component";
import { filterPaginationData } from "../components/pagination.component";
import InPageNavigation from "../components/inpageNavigation";
import BlogPostCard from "../components/blogcard.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/loadmoredata.component";
import PageNotFound from "../components/pagenotfound.component";

// Keep the export format consistent with your original code
const profileDataStructure = {
  personal_info: {
    fullname: "",
    username: "",
    bio: "",
    profile_img: "",
  },
  account_info: {
    total_posts: 0,
    total_reads: 0,
  },
  social_links: {},
  joinedAt: "",
};

const ProfilePage = () => {
  const { id: profileId } = useParams();
  const [profile, setProfile] = useState(profileDataStructure);
  let [loading, setLoading] = useState(true);
  let [blogs, setBlog] = useState(null);
  const navigate = useNavigate();

  let {
    personal_info: { fullname, username: profile_username, profile_img, bio },
    account_info: { total_posts, total_reads },
    social_links,
    joinedAt,
  } = profile;

  const {
    userAuth: { username: loggedInUsername, access_token },
  } = useContext(UserContext);

  const fetchUserProfile = () => {
    // If viewing your own profile, use the new endpoint
    if (profileId === loggedInUsername && access_token) {
      axios
        .get(`${import.meta.env.VITE_SERVER_HOST}/user-profile`, {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        })
        .then(({ data }) => {
          if (!data.user) {
            setLoading(false);
            return;
          }
          
          setProfile(data.user);
          
          // Initialize blog data with the blogs returned
          const formattedBlogs = {
            results: data.blogs || [],
            page: 1,
            totalDocs: data.blogs?.length || 0,
            user_id: data.user._id,
          };
          
          setBlog(formattedBlogs);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching own profile:", err);
          setLoading(false);
        });
    } else {
      // For other profiles
      axios
        .post(import.meta.env.VITE_SERVER_HOST + "/get-profile", {
          username: profileId,
        })
        .then(({ data: user }) => {
          if (user != null) {
            setProfile(user);
            getBlogs({ user_id: user._id });
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching profile:", err);
          setLoading(false);
        });
    }
  };

  const getBlogs = ({ page = 1, user_id }) => {
    const authorId = user_id || (blogs && blogs.user_id);
    
    if (!authorId) {
      console.error("No user ID available for fetching blogs");
      return;
    }
  
    axios
      .post(import.meta.env.VITE_SERVER_HOST + "/search-blogs", {
        author: authorId,
        page,
        limit: 5
      })
      .then(async ({ data }) => {
        let formatedData = await filterPaginationData({
          state: blogs,
          data: data.blogs,
          page,
          countRoute: "/search-blogs-count",
          data_To_Send: { author: authorId },
        });
  
        formatedData.user_id = authorId;
        setBlog(formatedData);
      })
      .catch((err) => {
        console.error("Error fetching blogs:", err);
      });
  };

  useEffect(() => {
    resetStates();
    fetchUserProfile();
  }, [profileId, loggedInUsername]);

  const resetStates = () => {
    setProfile(profileDataStructure);
    setBlog(null);
    setLoading(true);
  };

  return (
    <Animalwrapper>
      {loading ? (
        <Loader />
      ) : 
      profile_username.length ?
      (
        <section className="h-cover md:flex flex-row-reverse items-start gap-5 min-[1100px]:gap-12 ">
          <div className="flex flex-col max-md:items-center gap-5 min-w-[250px] md:w-[50%] md:pl-8 md:border-l border-grey md:top-[100px] py-10 mt-3 ">
            <img
              src={profile_img}
              className="w-48 h-48 rounded-full bg-grey md:h-32 md:w-32 "
              alt={`${profile_username}'s profile`}
              onError={(e) => {
                e.target.src = "https://via.placeholder.com/150?text=Profile";
              }}
            />
            <h1 className="text-2xl font-medium ">@{profile_username}</h1>
            <p className="text-xl capitalize h-6">{fullname}</p>
            <p>
              {total_posts.toLocaleString()} Blogs &nbsp;&nbsp;
              {total_reads.toLocaleString()} Reads
            </p>

            <div className="flex gap-4 mt-2">
              {profileId == loggedInUsername ? (
                <Link
                  to={"/settings/edit-profile"}
                  className="btn-light rounded-md"
                >
                  Edit Profile
                </Link>
              ) : (
                ""
              )}
            </div>

            <AboutUser
              className="max-md:hidden"
              bio={bio}
              social_links={social_links}
              joinedAt={joinedAt}
            />
          </div>

          <div className="max-md:mt-12 w-full">
            <InPageNavigation
              routes={["Blogs Published", "About"]}
              hiddenRoute={["About"]}
            >
              <>
                {blogs == null ? (
                  <Loader />
                ) : blogs.results.length ? (
                  blogs.results.map((blog, i) => {
                    return (
                      <Animalwrapper
                        transition={{ duration: 1, delay: i * 0.1 }}
                        key={i}
                      >
                        <BlogPostCard
                          content={blog}
                          author={blog.author?.personal_info || profile.personal_info}
                        />
                      </Animalwrapper>
                    );
                  })
                ) : (
                  <NoDataMessage message="No blogs published yet" />
                )}
                <LoadMoreDataBtn state={blogs} fetchDataFun={getBlogs} />
              </>
              <AboutUser
                bio={bio}
                social_links={social_links}
                joinedAt={joinedAt}
              />
            </InPageNavigation>
          </div>
        </section>
      ) : <PageNotFound />
    }
    </Animalwrapper>
  );
};

// Export consistently with how it was originally done
export { profileDataStructure };
export default ProfilePage;