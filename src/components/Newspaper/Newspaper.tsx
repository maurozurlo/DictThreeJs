import './Newspaper.css'
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type NewspaperProps = {
    headline?: string;
    date?: string;
}

function useRandomWidths(count: number, min: number, range: number) {
    return useMemo(() => Array.from({ length: count }, () => Math.random() * range + min), []);
}

const Newspaper = ({ headline, date }: NewspaperProps) => {
    const { t } = useTranslation();
    const weatherWidths = useRandomWidths(8, 60, 40);
    const leftStoryWidths = useRandomWidths(32, 70, 30);
    const centerCol1Widths = useRandomWidths(25, 70, 30);
    const centerCol2Widths = useRandomWidths(20, 70, 30);
    const centerCol2BotWidths = useRandomWidths(4, 70, 30);
    const centerCol3Widths = useRandomWidths(25, 70, 30);
    const sportsWidths = useRandomWidths(12, 70, 30);
    const rightWidths = useRandomWidths(20, 70, 30);

    return (
        <div className="newspaper-container">
            <header className="newspaper-header">
                <div className="header-decorations">
                    <div className="decoration-left">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="decoration-line"></div>
                        ))}
                    </div>
                    <div className="title-section">
                        <h1 className="main-title">The Daily Obedience</h1>
                    </div>
                    <div className="decoration-right">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="decoration-line"></div>
                        ))}
                    </div>
                </div>
                <div className="date-info">
                    <span>{date ?? '—'}</span>
                    <span>{t('log.no_charge')}</span>
                </div>
            </header>

            <div className="content-grid">
                <div className="left-column">
                    <div className="weather-box">
                        <div className="box-header"><h3>{t('log.weather')}</h3></div>
                        <div className="box-content">
                            {weatherWidths.map((w, i) => (
                                <div key={i} className="content-line weather-line" style={{ width: `${w}%` }}></div>
                            ))}
                        </div>
                    </div>
                    <div className="grestin-story">
                        <div className="story-content">
                            {leftStoryWidths.map((w, i) => (
                                <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="center-column">
                    <div className="main-headline">
                        <h1>{headline ?? ''}</h1>
                    </div>
                    <div className="article-columns">
                        <div className="article-column">
                            {centerCol1Widths.map((w, i) => (
                                <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                            ))}
                        </div>
                        <div className="article-column">
                            {centerCol2Widths.map((w, i) => (
                                <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                            ))}
                            <div className="photo-placeholder"></div>
                            {centerCol2BotWidths.map((w, i) => (
                                <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                            ))}
                        </div>
                        <div className="article-column">
                            {centerCol3Widths.map((w, i) => (
                                <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="right-column">
                    <div className="sports-box">
                        <div className="box-header"><h3>{t('log.sports')}</h3></div>
                        <div className="box-content">
                            {sportsWidths.map((w, i) => (
                                <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                            ))}
                        </div>
                    </div>
                    <div className="additional-content">
                        {rightWidths.map((w, i) => (
                            <div key={i} className="content-line" style={{ width: `${w}%` }}></div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bottom-border">
                <div className="bottom-decorations">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bottom-line"></div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Newspaper