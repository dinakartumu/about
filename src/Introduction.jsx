import React from 'react';
import Profileimage from './images/profile.JPG';
import './styles/Introduction.css';

class Introduction extends React.Component {
    render(){
        return (
            <div className='Introduction'>
                <div className='Profileimage'>
                    <img src={Profileimage} alt=""/>
                </div>
                <div className='Info'>
                    <h1>Dinakar Tumu</h1>
                    <h4>Web Developer</h4>
                </div>
                
            </div>
        )
    }
}

export default Introduction;
