import React from 'react';
import Twitterimage from './images/services/twitter.png';
import Githubimage from'./images/services/github.svg';
import './styles/Footer.css';

const services = [
    {
        name:'twitter',
        image:Twitterimage,
        link:'https://twitter.com/dinakar91'
    },
    {
        name:'github',
        image:Githubimage,
        link:'https://github.com/tumudinakar'
    }
];

const Footer = (props) =>{
    return(
        <div className='Footer'>   
            <div className='Name'>
                <h5>Follow me : </h5>
            </div>
            <div className='Serviceimage'>
                {services.map(eachservice=>
                    <div className='Eachservice'>
                        <a href={eachservice.link} target='_blank'>
                            <img src={eachservice.image} alt={eachservice.name}/>
                        </a>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Footer;
