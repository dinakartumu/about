import React from 'react';

// for wooter app
import Scorespage from './images/projects/wooter/scorespage.jpg';
import Teamspage from './images/projects/wooter/teamspage.png';
import Playerspage from './images/projects/wooter/playerspage.png';
import Gameschedule from './images/projects/wooter/gameschedule.png';

// for myactivities
import Homepage1 from './images/projects/myactvities/homepage1.png';
import Homepage2 from './images/projects/myactvities/homepage2.png';
import Yearpage from './images/projects/myactvities/yearpage.png';
import Placesyearpage from './images/projects/myactvities/placesyearpage.png';

// for Cobalt theme
import Userprofilepage from './images/projects/cobalttheme/userprofilepage.png';
import Commitdetailspage from './images/projects/cobalttheme/commitsdetailspage.png';
import Youtubechannelpage from './images/projects/cobalttheme/youtubechannelpage.png';
import Videoplayerpage from './images/projects/cobalttheme/playerpage.png';
import './styles/Projects.css';

class Projects extends React.Component {
    render(){
        return (
            <div className='Projects'>
                <div className='Header'>
                    <h2>Projects</h2>
                </div>
                <div className='Body'>
                    <div className='Eachproject'>
                        <div className='Projectname'>
                            <h3>Wooter</h3>
                            <p>iOS and Android App</p>
                        </div>
                        <div className='Projectimages'>
                            <div className='Eachimage'>
                                <img src={Scorespage} alt="" />          
                            </div>
                            <div className='Eachimage'>
                                <img src={Teamspage} alt="" />
                            </div>
                            <div className='Eachimage'>
                                <img src={Playerspage} alt="" />
                            </div>
                            <div className='Eachimage'>
                                <img src={Gameschedule} alt="" />
                            </div>
                        </div>
                    </div>  
                    <div className='Eachproject'>
                        <div className='Projectname'>
                            <h3>My Activities</h3>
                            <p>Website</p>
                        </div>
                        <div className='Projectimages Webapp'>
                            <div className='Eachimage'>
                                <img src={Homepage1} alt="" />          
                            </div>
                            <div className='Eachimage'>
                                <img src={Homepage2} alt="" />
                            </div>
                            <div className='Eachimage'>
                                <img src={Yearpage} alt="" />
                            </div>
                            <div className='Eachimage'>
                                <img src={Placesyearpage} alt="" />
                            </div>
                        </div>
                    </div>
                    <div className='Eachproject'>
                        <div className='Projectname'>
                            <h3>Cobalt Theme for github and youtube</h3>
                            <p>Chrome Extension</p>
                        </div>
                        <div className='Projectimages Webapp'>
                            <div className='Eachimage'>
                                <img src={Userprofilepage} alt="" />          
                            </div>
                            <div className='Eachimage'>
                                <img src={Commitdetailspage} alt="" />
                            </div>
                            <div className='Eachimage'>
                                <img src={Videoplayerpage} alt="" />
                            </div>
                            <div className='Eachimage'>
                                <img src={Youtubechannelpage} alt="" />
                            </div>
                        </div>
                    </div>  
                </div>
            </div>
        )
    }
}

export default Projects;
